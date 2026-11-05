"use client";

import { useActionState } from "react";
import { abrirCaja, cerrarCaja, type ResultadoCaja } from "@/lib/actions/cajas";

const inicial: ResultadoCaja = { ok: false };

export default function CajaForm({
  fecha,
  modo,
  montoApertura = 0,
}: {
  fecha: string;
  modo: "abrir" | "cerrar";
  montoApertura?: number;
}) {
  const accion = modo === "abrir" ? abrirCaja : cerrarCaja;
  const [estado, submit, pendiente] = useActionState(accion, inicial);

  return (
    <form action={submit} className="card flex flex-col gap-3">
      <input type="hidden" name="fecha" value={fecha} />

      <h2 className="card-title">
        {modo === "abrir" ? "🔓 Abrir caja" : "🔒 Cerrar caja"}
      </h2>

      {modo === "abrir" ? (
        <div>
          <label className="label" htmlFor="montoApertura">
            Monto inicial en caja (S/)
          </label>
          <input
            id="montoApertura"
            name="montoApertura"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="input"
            placeholder="0.00"
          />
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Monto de apertura: <strong>S/ {montoApertura.toFixed(2)}</strong> — registra el efectivo
          que queda al final del día.
        </div>
      )}

      <div>
        <label className="label" htmlFor="notas">
          Notas (opcional)
        </label>
        <input
          id="notas"
          name="notas"
          className="input"
          maxLength={300}
          placeholder="Observaciones..."
        />
      </div>

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          ✅ {modo === "abrir" ? "Caja abierta." : "Caja cerrada."}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="btn btn-primary w-full py-3">
        {pendiente
          ? "Procesando…"
          : modo === "abrir"
            ? "Abrir caja"
            : "Cerrar caja"}
      </button>
    </form>
  );
}
