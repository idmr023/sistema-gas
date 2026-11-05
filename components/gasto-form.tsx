"use client";

import { useActionState } from "react";
import { guardarGasto, type ResultadoGasto } from "@/lib/actions/gastos";

const inicial: ResultadoGasto = { ok: false };

const TIPOS = [
  { valor: "ALMUERZO", label: "🍽️ Almuerzo" },
  { valor: "TRANSPORTE", label: "🚚 Transporte" },
  { valor: "MANTENIMIENTO", label: "🔧 Mantenimiento" },
  { valor: "OTRO", label: "📦 Otro" },
] as const;

export default function GastoForm({ fecha }: { fecha: string }) {
  const [estado, submit, pendiente] = useActionState(guardarGasto, inicial);

  return (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="fecha" value={fecha} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" className="input" defaultValue="ALMUERZO">
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="monto">Monto (S/)</label>
          <input
            id="monto"
            name="monto"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="input"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label" htmlFor="colaboradores">Colaboradores</label>
          <input
            id="colaboradores"
            name="colaboradores"
            className="input"
            maxLength={200}
            placeholder="Adolfo, David..."
          />
        </div>
        <div>
          <label className="label" htmlFor="descripcion">Descripción</label>
          <input
            id="descripcion"
            name="descripcion"
            className="input"
            maxLength={300}
            placeholder="Detalle..."
          />
        </div>
      </div>

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          ✅ Gasto registrado.
        </p>
      )}

      <button type="submit" disabled={pendiente} className="btn btn-primary">
        {pendiente ? "Guardando…" : "Registrar gasto"}
      </button>
    </form>
  );
}
