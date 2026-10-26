import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { isoAFecha, hoyISO, diasAtrasISO, fechaLarga } from "@/lib/dates";
import { num, sol } from "@/lib/money";
import VentaFila from "@/components/venta-fila";

export const metadata = { title: "Ventas" };

const ESTADOS = ["", "PENDIENTE", "PARCIAL", "PAGADO"];

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const desde = uno(sp.desde) || diasAtrasISO(14);
  const hasta = uno(sp.hasta) || hoyISO();
  const estado = uno(sp.estado);
  const repartidor = uno(sp.repartidor);
  const q = uno(sp.q);

  const where: Prisma.VentaWhereInput = {
    fecha: { gte: isoAFecha(desde), lte: isoAFecha(hasta) },
  };
  if (ESTADOS.includes(estado) && estado) {
    where.estado = estado as "PENDIENTE" | "PARCIAL" | "PAGADO";
  }
  if (repartidor) where.repartidorId = Number(repartidor);
  if (q) {
    where.OR = [
      { clienteNombre: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
      { direccion: { contains: q, mode: "insensitive" } },
      { notas: { contains: q, mode: "insensitive" } },
    ];
  }

  const [ventas, total, repartidores, agg] = await Promise.all([
    prisma.venta.findMany({
      where,
      include: {
        marca: { select: { nombre: true } },
        repartidor: { select: { nombre: true } },
        pagos: {
          select: { id: true, monto: true, metodo: true, fecha: true, referencia: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 200,
    }),
    prisma.venta.count({ where }),
    prisma.repartidor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.venta.aggregate({
      where,
      _sum: { total: true, aCuenta: true, saldo: true, cantidad: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Ventas</h1>
          <p className="text-sm text-slate-500">
            {fechaLarga(desde)} → {fechaLarga(hasta)} · {total} venta(s)
          </p>
        </div>
        <Link href="/ventas/nueva" className="btn btn-primary">
          + Nueva venta
        </Link>
      </div>

      <form method="GET" className="card grid gap-3 sm:grid-cols-5">
        <div>
          <label className="label" htmlFor="desde">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="hasta">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="repartidor">Repartidor</label>
          <select id="repartidor" name="repartidor" defaultValue={repartidor} className="input">
            <option value="">Todos</option>
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado} className="input">
            <option value="">Todos</option>
            <option value="PAGADO">Pagado</option>
            <option value="PARCIAL">Con saldo</option>
            <option value="PENDIENTE">Sin pago</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="q">Buscar</label>
            <input id="q" name="q" defaultValue={q} className="input" placeholder="Cliente, tel…" />
          </div>
          <button type="submit" className="btn btn-ghost">Filtrar</button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card stat">
          <span className="stat-label">Vendido</span>
          <span className="stat-value">{sol(num(agg._sum.total))}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Cobrado</span>
          <span className="stat-value text-emerald-600">{sol(num(agg._sum.aCuenta))}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">A saldo</span>
          <span className="stat-value text-brand-600">{sol(num(agg._sum.saldo))}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Balones</span>
          <span className="stat-value">{num(agg._sum.cantidad)}</span>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {ventas.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No hay ventas en este rango. Registra la primera con{" "}
            <Link href="/ventas/nueva" className="font-bold text-brand-600">Nueva venta</Link>.
          </p>
        ) : (
          ventas.map((v) => <VentaFila key={v.id} venta={v} />)
        )}
      </div>
    </div>
  );
}
