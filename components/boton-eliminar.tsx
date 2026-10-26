"use client";

import { useState, useTransition } from "react";

/** Botón de borrado con confirmación en el navegador (no en el servidor). */
export default function BotonEliminar({
  accion,
  mensaje,
  etiqueta = "🗑",
  titulo,
}: {
  accion: () => Promise<unknown>;
  mensaje: string;
  etiqueta?: string;
  titulo?: string;
}) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        title={titulo ?? mensaje}
        disabled={pendiente}
        className="btn btn-ghost btn-sm text-red-500"
        onClick={() => {
          if (!window.confirm(mensaje)) return;
          start(async () => {
            try {
              const r = (await accion()) as { ok?: boolean; error?: string } | undefined;
              if (r && r.ok === false) setAviso(r.error ?? "No se pudo eliminar.");
              else setAviso(null);
            } catch {
              setAviso("Error al eliminar.");
            }
          });
        }}
      >
        {pendiente ? "…" : etiqueta}
      </button>
      {aviso && <span className="ml-2 text-xs font-semibold text-red-500">{aviso}</span>}
    </>
  );
}
