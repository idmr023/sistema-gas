import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { hoyISO, moverDias, isoAFecha, fechaLegible, fechaLarga } from "@/lib/dates";
import InventarioForm from "@/components/inventario-form";

export const metadata = { title: "Inventario" };

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const fecha = (Array.isArray(sp.fecha) ? sp.fecha[0] : sp.fecha) || hoyISO();
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyISO();

  const [marcas, registros, ayer, ventasDia] = await Promise.all([
    prisma.marca.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.inventarioDiario.findMany({ where: { fecha: isoAFecha(valida) } }),
    prisma.inventarioDiario.findMany({
      where: { fecha: isoAFecha(moverDias(valida, -1)) },
      select: { marcaId: true, vacios: true },
    }),
    prisma.venta.groupBy({
      by: ["marcaId"],
      where: { fecha: isoAFecha(valida) },
      _sum: { cantidad: true },
    }),
  ]);

  const porMarca = new Map(registros.map((r) => [r.marcaId, r]));
  const vaciosAyer = new Map(ayer.map((r) => [r.marcaId, r.vacios]));
  const ventasPorMarca = new Map(ventasDia.map((v) => [v.marcaId, v._sum.cantidad ?? 0]));

  const filas = marcas.map((m) => {
    const reg = porMarca.get(m.id);
    const registrado = ventasPorMarca.get(m.id) ?? 0;
    return {
      marcaId: m.id,
      marca: m.nombre,
      // Si el día no está capturado, el inicio sugiere los vacíos de ayer.
      inicio: reg ? reg.inicio : (vaciosAyer.get(m.id) ?? 0),
      comprados: reg?.comprados ?? 0,
      vacios: reg?.vacios ?? 0,
      notas: reg?.notas ?? "",
      calculado: reg ? reg.inicio + reg.comprados - reg.vacios : 0,
      registrado,
    };
  });

  const capturado = registros.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Inventario diario</h1>
          <p className="text-sm capitalize text-slate-500">{fechaLegible(valida)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/inventario?fecha=${moverDias(valida, -1)}`} className="btn btn-ghost btn-sm">
            ← Ayer
          </Link>
          <Link href={`/inventario?fecha=${moverDias(valida, 1)}`} className="btn btn-ghost btn-sm">
            Mañana →
          </Link>
          <Link href="/inventario" className="btn btn-ghost btn-sm">
            Hoy
          </Link>
        </div>
      </div>

      {!capturado && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
          📝 Aún no se captura el inventario de {fechaLarga(valida)}. El{" "}
          <strong>Inicio</strong> viene con los vacíos del día anterior.
        </p>
      )}

      <InventarioForm fecha={valida} filas={filas} />

      <div className="card text-sm text-slate-600">
        <h2 className="card-title">Cómo se calcula</h2>
        <p>
          <strong>Venta del día = Inicio + Comprados − Vacios</strong> (por marca). La columna{" "}
          <strong>Registrado</strong> muestra las ventas cargadas en el sistema ese día; si hay
          diferencia, revisa si faltó una venta o un conteo.
        </p>
      </div>
    </div>
  );
}
