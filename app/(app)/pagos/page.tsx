import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { isoAFecha, hoyISO, diasAtrasISO, fechaLarga } from "@/lib/dates";
import { num, sol } from "@/lib/money";
import { eliminarPago } from "@/lib/actions/ventas";
import BotonEliminar from "@/components/boton-eliminar";
import AsignarPago from "@/components/asignar-pago";

export const metadata = { title: "Pagos" };

const ORIGEN: Record<string, string> = {
  MANUAL: "Manual",
  IMAP: "Correo Yape",
  WEBHOOK: "Webhook",
};

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const desde = uno(sp.desde) || diasAtrasISO(14);
  const hasta = uno(sp.hasta) || hoyISO();
  const metodo = uno(sp.metodo);

  const where: Prisma.PagoWhereInput = {
    fecha: { gte: isoAFecha(desde), lte: isoAFecha(hasta) },
  };
  if (metodo && ["EFECTIVO", "YAPE", "TRANSFERENCIA", "OTRO"].includes(metodo)) {
    where.metodo = metodo as "EFECTIVO" | "YAPE" | "TRANSFERENCIA" | "OTRO";
  }

  const [pagos, agg] = await Promise.all([
    prisma.pago.findMany({
      where,
      include: {
        venta: { select: { id: true, clienteNombre: true, marca: { select: { nombre: true } } } },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 300,
    }),
    prisma.pago.aggregate({ where, _sum: { monto: true }, _count: true }),
  ]);

  const porMetodo = await prisma.pago.groupBy({
    by: ["metodo"],
    where,
    _sum: { monto: true },
  });

  const ventasAbiertas = await prisma.venta.findMany({
    where: { saldo: { gt: 0 }, estado: { not: "PAGADO" } },
    select: { id: true, clienteNombre: true, saldo: true },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: 40,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Pagos</h1>
          <p className="text-sm text-slate-500">
            {fechaLarga(desde)} → {fechaLarga(hasta)} · {agg._count} pago(s)
          </p>
        </div>
        <Link href="/ventas/nueva" className="btn btn-primary">
          + Nueva venta
        </Link>
      </div>

      <form method="GET" className="card grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="desde">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="hasta">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="metodo">Método</label>
          <select id="metodo" name="metodo" defaultValue={metodo} className="input">
            <option value="">Todos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="YAPE">Yape</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn btn-ghost w-full">Filtrar</button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card stat">
          <span className="stat-label">Total cobrado</span>
          <span className="stat-value">{sol(num(agg._sum.monto))}</span>
        </div>
        {porMetodo.map((m) => (
          <div key={m.metodo} className="card stat">
            <span className="stat-label">{m.metodo}</span>
            <span className="text-lg font-extrabold">{sol(num(m._sum.monto))}</span>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-base min-w-[860px]">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Venta</th>
              <th>Método</th>
              <th>Origen</th>
              <th>Referencia</th>
              <th>Estado</th>
              <th className="text-right">Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  Sin pagos en este rango.
                </td>
              </tr>
            )}
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{fechaLarga(p.fecha.toISOString().slice(0, 10))}</td>
                <td>
                  <Link href={`/ventas?q=${p.venta?.clienteNombre ?? ""}`} className="font-semibold text-brand-600">
                    #{p.ventaId ?? "—"} {p.venta?.clienteNombre ?? ""}
                  </Link>
                </td>
                <td>
                  <span
                    className={
                      p.metodo === "YAPE"
                        ? "badge badge-amber"
                        : p.metodo === "EFECTIVO"
                          ? "badge badge-green"
                          : "badge badge-slate"
                    }
                  >
                    {p.metodo}
                  </span>
                </td>
                <td className="text-xs text-slate-500">{ORIGEN[p.origen] ?? p.origen}</td>
                <td className="text-xs text-slate-500">{p.referencia ?? "—"}</td>
                <td>
                  {p.estado === "CONFIRMADO" ? (
                    <span className="badge badge-green">Aplicado</span>
                  ) : (
                    <span className="badge badge-amber">Por asignar</span>
                  )}
                </td>
                <td className="text-right font-extrabold">{sol(num(p.monto))}</td>
                <td className="text-right whitespace-nowrap">
                  {p.estado !== "CONFIRMADO" && (
                    <div className="mb-1 flex justify-end">
                      <AsignarPago
                        pagoId={p.id}
                        ventas={ventasAbiertas.map((v) => ({
                          id: v.id,
                          clienteNombre: v.clienteNombre,
                          saldo: String(v.saldo),
                        }))}
                      />
                    </div>
                  )}
                  <BotonEliminar
                    accion={eliminarPago.bind(null, p.id)}
                    mensaje="¿Eliminar este pago? Se recalcula el saldo."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
