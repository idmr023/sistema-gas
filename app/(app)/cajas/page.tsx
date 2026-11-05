import Link from "next/link";
import { Suspense } from "react";
import { exigirPermiso } from "@/lib/auth";
import { hoyISO, moverDias, fechaLegible, fechaLarga } from "@/lib/dates";
import { sol, num } from "@/lib/money";
import { resumenCaja } from "@/lib/actions/cajas";
import CajaForm from "@/components/caja-form";
import GastoForm from "@/components/gasto-form";

export const metadata = { title: "Cajas" };

export default function CajasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <CajasPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CajasPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPermiso("cajas");
  const sp = await searchParams;
  const fecha = (Array.isArray(sp.fecha) ? sp.fecha[0] : sp.fecha) || hoyISO();
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyISO();

  const r = await resumenCaja(valida);

  const abierta = r.estado === "ABIERTA";
  const cerrada = r.estado === "CERRADA";
  const noExiste = r.estado === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Cajas</h1>
          <p className="text-sm capitalize text-slate-500">{fechaLegible(valida)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/cajas?fecha=${moverDias(valida, -1)}`} className="btn btn-ghost btn-sm">
            ← Ayer
          </Link>
          <Link href={`/cajas?fecha=${moverDias(valida, 1)}`} className="btn btn-ghost btn-sm">
            Mañana →
          </Link>
          <Link href="/cajas" className="btn btn-ghost btn-sm">
            Hoy
          </Link>
        </div>
      </div>

      {/* Estado de la caja */}
      {noExiste && (
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
          📝 No hay caja registrada para {fechaLarga(valida)}. Abre la caja para iniciar el día.
        </div>
      )}
      {abierta && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          ✅ Caja abierta — monto inicial: {sol(r.apertura)}
        </div>
      )}
      {cerrada && (
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          🔒 Caja cerrada — cierre: {r.cierre !== null ? sol(r.cierre) : "—"}
        </div>
      )}

      {/* Resumen de la caja */}
      {!noExiste && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card stat">
            <span className="stat-label">Apertura</span>
            <span className="stat-value">{sol(r.apertura)}</span>
            <span className="text-xs text-slate-400">inicio del día</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Efectivo cobrado</span>
            <span className="stat-value text-emerald-600">{sol(r.efectivoCobrado)}</span>
            <span className="text-xs text-slate-400">pagos en efectivo</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Gastos</span>
            <span className="stat-value text-red-600">−{sol(r.totalGastos)}</span>
            <span className="text-xs text-slate-400">{r.gastos.length} registro(s)</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Esperado en caja</span>
            <span className="stat-value text-brand-600">{sol(r.esperado)}</span>
            <span className="text-xs text-slate-400">apertura + cobros − gastos</span>
          </div>
        </div>
      )}

      {/* Diferencia al cerrar */}
      {cerrada && r.diferencia !== null && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-bold ${
            Math.abs(r.diferencia) < 0.01
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {Math.abs(r.diferencia) < 0.01
            ? "✅ La caja cuadra perfectamente."
            : `⚠️ Diferencia: ${r.diferencia > 0 ? "+" : ""}${sol(r.diferencia)} (${r.diferencia > 0 ? "sobra" : "falta"})`}
        </div>
      )}

      {/* Formulario: abrir o cerrar */}
      {noExiste && <CajaForm fecha={valida} modo="abrir" />}
      {abierta && <CajaForm fecha={valida} modo="cerrar" montoApertura={r.apertura} />}

      {/* Gastos del día */}
      {!noExiste && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title">💸 Gastos del día</h2>
            <Link href={`/gastos?fecha=${valida}`} className="btn btn-ghost btn-sm">
              Ver todos →
            </Link>
          </div>
          {r.gastos.length === 0 ? (
            <p className="text-sm text-slate-400">Sin gastos registrados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {r.gastos.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="badge badge-slate mr-2">{g.tipo}</span>
                    <span className="font-semibold">{g.colaboradores || "—"}</span>
                    {g.descripcion && (
                      <span className="ml-2 text-slate-400">— {g.descripcion}</span>
                    )}
                  </div>
                  <span className="font-extrabold text-red-600">−{sol(num(g.monto))}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <GastoForm fecha={valida} />
          </div>
        </section>
      )}
    </div>
  );
}
