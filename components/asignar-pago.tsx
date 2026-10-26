"use client";

import { useActionState } from "react";
import { asignarPago } from "@/lib/actions/ventas";

type VentaAbierta = { id: number; clienteNombre: string | null; saldo: number | string };

export default function AsignarPago({
  pagoId,
  ventas,
}: {
  pagoId: number;
  ventas: VentaAbierta[];
}) {
  const [estado, accion, pendiente] = useActionState(asignarPago, { ok: false });

  if (ventas.length === 0) {
    return <span className="text-xs text-slate-400">Sin ventas con saldo</span>;
  }

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="pagoId" value={pagoId} />
      <select name="ventaId" className="input !w-auto !py-1 text-xs" required defaultValue="">
        <option value="" disabled>
          Asignar a…
        </option>
        {ventas.map((v) => (
          <option key={v.id} value={String(v.id)}>
            #{v.id} {v.clienteNombre ?? "Mostrador"} · saldo S/ {Number(v.saldo).toFixed(2)}
          </option>
        ))}
      </select>
      <button className="btn btn-primary btn-sm" disabled={pendiente}>
        {pendiente ? "…" : "Aplicar"}
      </button>
      {estado.error && <span className="text-xs font-semibold text-red-500">{estado.error}</span>}
    </form>
  );
}
