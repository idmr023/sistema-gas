import Link from "next/link";
import { Suspense } from "react";
import { exigirPermiso } from "@/lib/auth";
import { hoyISO, moverDias, fechaLegible } from "@/lib/dates";
import { sol, num } from "@/lib/money";
import { gastosDelDia } from "@/lib/actions/gastos";
import GastoForm from "@/components/gasto-form";

export const metadata = { title: "Gastos" };

const TIPO_LABEL: Record<string, string> = {
  ALMUERZO: "🍽️ Almuerzo",
  TRANSPORTE: "🚚 Transporte",
  MANTENIMIENTO: "🔧 Mantenimiento",
  OTRO: "📦 Otro",
};

export default function GastosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <GastosPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function GastosPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPermiso("gastos");
  const sp = await searchParams;
  const fecha = (Array.isArray(sp.fecha) ? sp.fecha[0] : sp.fecha) || hoyISO();
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyISO();

  const r = await gastosDelDia(valida);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Gastos</h1>
          <p className="text-sm capitalize text-slate-500">{fechaLegible(valida)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/gastos?fecha=${moverDias(valida, -1)}`} className="btn btn-ghost btn-sm">
            ← Ayer
          </Link>
          <Link href={`/gastos?fecha=${moverDias(valida, 1)}`} className="btn btn-ghost btn-sm">
            Mañana →
          </Link>
          <Link href="/gastos" className="btn btn-ghost btn-sm">
            Hoy
          </Link>
        </div>
      </div>

      {/* Resumen por tipo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card stat">
          <span className="stat-label">🍽️ Almuerzos</span>
          <span className="stat-value text-red-600">{sol(r.totalAlmuerzos)}</span>
          <span className="text-xs text-slate-400">
            {r.almuerzos.length} registro(s)
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Total gastos</span>
          <span className="stat-value">{sol(r.total)}</span>
          <span className="text-xs text-slate-400">{r.gastos.length} registro(s)</span>
        </div>
        {Object.entries(r.porTipo)
          .filter(([t]) => t !== "ALMUERZO")
          .slice(0, 2)
          .map(([tipo, monto]) => (
            <div key={tipo} className="card stat">
              <span className="stat-label">{TIPO_LABEL[tipo] ?? tipo}</span>
              <span className="stat-value">{sol(monto)}</span>
            </div>
          ))}
      </div>

      {/* Formulario nuevo gasto */}
      <section className="card">
        <h2 className="card-title">➕ Registrar gasto</h2>
        <GastoForm fecha={valida} />
      </section>

      {/* Lista de gastos */}
      <section className="card">
        <h2 className="card-title">📋 Gastos de {fechaLegible(valida)}</h2>
        {r.gastos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin gastos registrados este día.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="table-base min-w-[500px]">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Colaboradores</th>
                  <th>Descripción</th>
                  <th className="text-right">Monto</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {r.gastos.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="badge badge-slate">{TIPO_LABEL[g.tipo] ?? g.tipo}</span>
                    </td>
                    <td className="font-semibold">{g.colaboradores || "—"}</td>
                    <td className="text-slate-500">{g.descripcion || "—"}</td>
                    <td className="text-right font-extrabold text-red-600">
                      −{sol(num(g.monto))}
                    </td>
                    <td className="text-center">
                      <form action={async () => {
                        "use server";
                        const { eliminarGasto } = await import("@/lib/actions/gastos");
                        await eliminarGasto(g.id);
                      }}>
                        <button type="submit" className="btn btn-ghost btn-sm text-red-500">
                          ✕
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-extrabold">
                  <td colSpan={3}>TOTAL</td>
                  <td className="text-right text-red-600">{sol(r.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Almuerzos resumen */}
      {r.almuerzos.length > 0 && (
        <section className="card ring-amber-200">
          <h2 className="card-title">🍽️ Almuerzos de colaboradores</h2>
          <p className="mb-2 text-2xl font-extrabold text-red-600">{sol(r.totalAlmuerzos)}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {r.almuerzos.map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span>
                  {g.colaboradores || "Sin especificar"}
                  {g.descripcion && <span className="text-slate-400"> — {g.descripcion}</span>}
                </span>
                <span className="font-bold">{sol(num(g.monto))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
