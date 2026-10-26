import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { isoAFecha, hoyISO, diasAtrasISO, fechaLarga } from "@/lib/dates";
import { num, sol, aDecimal, pct } from "@/lib/money";

export const metadata = { title: "Reportes" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const desde = uno(sp.desde) || diasAtrasISO(29);
  const hasta = uno(sp.hasta) || hoyISO();
  const where = { fecha: { gte: isoAFecha(desde), lte: isoAFecha(hasta) } };

  const [
    agg,
    porRep,
    porMarca,
    porEstado,
    topClientes,
    deudores,
    prestados,
    pagosPorMetodo,
    totalVentasCount,
  ] = await Promise.all([
    prisma.venta.aggregate({
      where,
      _sum: { total: true, aCuenta: true, saldo: true, cantidad: true },
      _count: true,
    }),
    prisma.venta.groupBy({
      by: ["repartidorId"],
      where,
      _sum: { total: true, aCuenta: true, saldo: true, cantidad: true },
      _count: true,
    }),
    prisma.venta.groupBy({
      by: ["marcaId"],
      where,
      _sum: { total: true, cantidad: true },
      _count: true,
    }),
    prisma.venta.groupBy({ by: ["estado"], where, _count: true, _sum: { saldo: true } }),
    prisma.venta.groupBy({
      by: ["clienteId"],
      where: { ...where, clienteId: { not: null } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 8,
    }),
    prisma.venta.findMany({
      where: { estado: { in: ["PENDIENTE", "PARCIAL"] } },
      select: {
        id: true,
        fecha: true,
        clienteNombre: true,
        telefono: true,
        saldo: true,
        marca: { select: { nombre: true } },
      },
      orderBy: { fecha: "asc" },
      take: 100,
    }),
    prisma.venta.count({ where: { prestado: true, regresado: false } }),
    prisma.pago.groupBy({ by: ["metodo"], where: { fecha: where.fecha }, _sum: { monto: true } }),
    prisma.cliente.count(),
  ]);

  const [repartidores, marcas, clientes] = await Promise.all([
    prisma.repartidor.findMany({ select: { id: true, nombre: true } }),
    prisma.marca.findMany({ select: { id: true, nombre: true } }),
    prisma.cliente.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombreRep = new Map(repartidores.map((r) => [r.id, r.nombre]));
  const nombreMarca = new Map(marcas.map((m) => [m.id, m.nombre]));
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]));

  const total = num(agg._sum.total);
  const cobrado = num(agg._sum.aCuenta);
  const saldo = num(agg._sum.saldo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Reportes</h1>
          <p className="text-sm text-slate-500">
            {fechaLarga(desde)} → {fechaLarga(hasta)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" href={`/api/exportar?tipo=ventas&desde=${desde}&hasta=${hasta}`}>
            ⬇ Ventas CSV
          </a>
          <a className="btn btn-ghost btn-sm" href={`/api/exportar?tipo=pagos&desde=${desde}&hasta=${hasta}`}>
            ⬇ Pagos CSV
          </a>
        </div>
      </div>

      <form method="GET" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="desde">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="hasta">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} className="input" />
        </div>
        <button className="btn btn-primary">Aplicar</button>
        <a href="/reportes" className="btn btn-ghost">
          Últimos 30 días
        </a>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card stat">
          <span className="stat-label">Vendido</span>
          <span className="stat-value">{sol(total)}</span>
          <span className="text-xs text-slate-400">
            {agg._count} venta(s) · {num(agg._sum.cantidad)} balón(es)
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Cobrado</span>
          <span className="stat-value text-emerald-600">{sol(cobrado)}</span>
          <span className="text-xs text-slate-400">{pct(cobrado, total)}% del total</span>
        </div>
        <div className="card stat">
          <span className="stat-label">A cobrar</span>
          <span className="stat-value text-brand-600">{sol(saldo)}</span>
          <span className="text-xs text-slate-400">
            {porEstado.find((e) => e.estado !== "PAGADO")?._count ?? 0} venta(s)
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Ticket promedio</span>
          <span className="stat-value">{sol(agg._count ? total / agg._count : 0)}</span>
          <span className="text-xs text-slate-400">Balones prestados: {prestados}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">🛵 Por repartidor</h2>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="text-right">Balones</th>
                  <th className="text-right">Vendido</th>
                  <th className="text-right">Cobrado</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {porRep.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-slate-400">Sin ventas.</td>
                  </tr>
                )}
                {porRep.map((r) => (
                  <tr key={r.repartidorId ?? "sin"}>
                    <td className="font-semibold">
                      {r.repartidorId ? (nombreRep.get(r.repartidorId) ?? "—") : "Sin asignar"}
                    </td>
                    <td className="text-right">{num(r._sum.cantidad)}</td>
                    <td className="text-right font-bold">{sol(num(r._sum.total))}</td>
                    <td className="text-right text-emerald-600">{sol(num(r._sum.aCuenta))}</td>
                    <td className="text-right text-brand-600">{sol(num(r._sum.saldo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">🛢️ Por marca</h2>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Balones</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {porMarca.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-slate-400">Sin ventas.</td>
                  </tr>
                )}
                {porMarca.map((m) => (
                  <tr key={m.marcaId ?? "sin"}>
                    <td className="font-semibold">
                      {m.marcaId ? (nombreMarca.get(m.marcaId) ?? "—") : "Sin marca"}
                    </td>
                    <td className="text-right">{m._count}</td>
                    <td className="text-right">{num(m._sum.cantidad)}</td>
                    <td className="text-right font-bold">{sol(num(m._sum.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">💳 Cobros por método</h2>
          <ul className="flex flex-col gap-2">
            {pagosPorMetodo.length === 0 && (
              <li className="text-sm text-slate-400">Sin pagos en el rango.</li>
            )}
            {pagosPorMetodo.map((m) => (
              <li key={m.metodo} className="flex justify-between text-sm">
                <span className="font-semibold">{m.metodo}</span>
                <span className="font-extrabold">{sol(num(m._sum.monto))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="card-title">🏆 Clientes que más compran</h2>
          <ul className="flex flex-col gap-2">
            {topClientes.length === 0 && (
              <li className="text-sm text-slate-400">Sin ventas con cliente.</li>
            )}
            {topClientes.map((c, i) => (
              <li key={c.clienteId} className="flex justify-between gap-2 text-sm">
                <span>
                  {i + 1}. {c.clienteId ? (nombreCliente.get(c.clienteId) ?? "—") : "—"}
                </span>
                <span className="font-extrabold">{sol(num(c._sum.total))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">{totalVentasCount} cliente(s) en la base</p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">💳 Saldos pendientes ({deudores.length})</h2>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Marca</th>
                <th className="text-right">Debe</th>
                <th>Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {deudores.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-emerald-600">✅ Todo cobrado en este rango.</td>
                </tr>
              )}
              {deudores.map((d) => (
                <tr key={d.id}>
                  <td>{fechaLarga(d.fecha.toISOString().slice(0, 10))}</td>
                  <td className="font-semibold">{d.clienteNombre ?? "Mostrador"}</td>
                  <td>{d.marca?.nombre ?? "—"}</td>
                  <td className="text-right font-extrabold text-brand-600">
                    {sol(num(d.saldo))}
                  </td>
                  <td className="text-xs text-slate-500">{d.telefono ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {deudores.length > 0 && (
          <p className="mt-2 text-sm font-bold text-brand-700">
            Total por cobrar: {sol(deudores.reduce((a, d) => a + num(d.saldo), 0))} (muestra máx.
            100)
          </p>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">
        Resumen guardado con aDecimal: vendido {aDecimal(total)} · cobrado {aDecimal(cobrado)} ·
        saldo {aDecimal(saldo)}
      </p>
    </div>
  );
}
