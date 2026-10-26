import Link from "next/link";
import { exigirSesion } from "@/lib/auth";
import { fechaLegible, fechaLarga } from "@/lib/dates";
import { num, sol } from "@/lib/money";
import { resumenHoy, serieDiaria, porRepartidor, balonesPrestados, saldosPendientes } from "@/lib/queries";

export const metadata = { title: "Inicio" };

export default async function Dashboard() {
  await exigirSesion();

  const [hoy, semana, reps, prestados, saldos] = await Promise.all([
    resumenHoy(),
    serieDiaria(7),
    porRepartidor(),
    balonesPrestados(),
    saldosPendientes(),
  ]);

  const max = Math.max(...semana.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold">Inicio</h1>
        <p className="text-sm capitalize text-slate-500">{fechaLegible(hoy.fecha)}</p>
      </div>

      {/* Tarjetas del día */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card stat">
          <span className="stat-label">Vendido hoy</span>
          <span className="stat-value">{sol(hoy.totalVendido)}</span>
          <span className="text-xs text-slate-400">{hoy.ventas} venta(s)</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Cobrado</span>
          <span className="stat-value text-emerald-600">{sol(hoy.cobrado)}</span>
          <span className="text-xs text-slate-400">a cuenta</span>
        </div>
        <div className="card stat">
          <span className="stat-label">A saldo</span>
          <span className="stat-value text-brand-600">{sol(hoy.saldo)}</span>
          <span className="text-xs text-slate-400">{hoy.ventasASaldo} venta(s) pendientes</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Balones hoy</span>
          <span className="stat-value">{hoy.balones}</span>
          <span className="text-xs text-slate-400">{hoy.balonesPremium} premium</span>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/ventas/nueva" className="card flex items-center gap-3 font-bold hover:bg-brand-50">
          🧾 Nueva venta
        </Link>
        <Link href="/inventario" className="card flex items-center gap-3 font-bold hover:bg-brand-50">
          🛢️ Inventario
        </Link>
        <Link href="/pagos" className="card flex items-center gap-3 font-bold hover:bg-brand-50">
          💰 Pagos
        </Link>
        <Link href="/reportes" className="card flex items-center gap-3 font-bold hover:bg-brand-50">
          📈 Reportes
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Semana */}
        <section className="card">
          <h2 className="card-title">Últimos 7 días</h2>
          <div className="flex h-40 items-end gap-2">
            {semana.map((d) => (
              <div key={d.fecha} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500">
                  {d.total > 0 ? Math.round(d.total) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand-400 transition-all"
                  style={{ height: `${Math.max((d.total / max) * 100, d.total > 0 ? 6 : 2)}%` }}
                  title={`${fechaLarga(d.fecha)}: ${sol(d.total)}`}
                />
                <span className="text-[10px] text-slate-400">{d.fecha.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Repartidores */}
        <section className="card">
          <h2 className="card-title">Hoy por repartidor</h2>
          {reps.length === 0 ? (
            <p className="text-sm text-slate-400">Sin ventas registradas hoy.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reps.map((r) => (
                <li key={r.nombre} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{r.nombre}</span>
                  <span className="text-slate-500">{r.balones} balón(es)</span>
                  <span className="font-extrabold">{sol(r.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Alertas */}
      {(prestados.length > 0 || saldos.cantidad > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {prestados.length > 0 && (
            <section className="card ring-red-200">
              <h2 className="card-title text-red-600">
                ⚠️ Balones prestados sin devolver ({prestados.length})
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {prestados.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {p.clienteNombre || "Mostrador"} · {p.cantidad} {p.marca?.nombre ?? ""}
                    </span>
                    <span className="text-slate-400">{fechaLarga(p.fecha.toISOString().slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
              <Link href="/ventas?estado=PENDIENTE" className="mt-2 block text-xs font-bold text-brand-600">
                Ver ventas →
              </Link>
            </section>
          )}

          {saldos.cantidad > 0 && (
            <section className="card">
              <h2 className="card-title">💳 Por cobrar ({saldos.cantidad})</h2>
              <p className="text-2xl font-extrabold text-brand-600">{sol(saldos.totalSaldo)}</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {saldos.ventas.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {v.clienteNombre || "Mostrador"} · {v.marca?.nombre ?? ""}
                    </span>
                    <span className="font-bold">{sol(v.saldo as unknown as number)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/reportes" className="mt-2 block text-xs font-bold text-brand-600">
                Ver reporte de saldos →
              </Link>
            </section>
          )}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Balones prestados activos: {num(hoy.balonesPrestados)}
      </p>
    </div>
  );
}
