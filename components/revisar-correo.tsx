"use client";

import { useState } from "react";
import { revisarAhora } from "@/lib/actions/imap";

export default function RevisarCorreo() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function revisar() {
    setCargando(true);
    setResultado(null);
    try {
      const r = await revisarAhora();
      if (!r.ok) setResultado(`⚠️ ${r.error ?? "No se pudo revisar"}`);
      else if (r.nuevos > 0) setResultado(`✅ ${r.nuevos} pago(s) nuevo(s) detectado(s).`);
      else setResultado(`✅ Revisado: ${r.revisados} correo(s), sin pagos nuevos.`);
    } catch {
      setResultado("⚠️ Error al revisar el correo.");
    }
    setCargando(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-ghost" onClick={revisar} disabled={cargando}>
        {cargando ? "Revisando…" : "📨 Revisar correo ahora"}
      </button>
      {resultado && <span className="text-sm font-semibold text-slate-600">{resultado}</span>}
    </div>
  );
}
