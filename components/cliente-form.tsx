"use client";

import { useActionState, useEffect, useRef } from "react";
import { guardarCliente, type ResultadoCliente } from "@/lib/actions/clientes";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
};

const inicial: ResultadoCliente = { ok: false };

export default function ClienteForm({ editar }: { editar: Cliente | null }) {
  const [estado, accion, pendiente] = useActionState(guardarCliente, inicial);
  const ref = useRef<HTMLFormElement>(null);
  const listo = estado.ok;

  useEffect(() => {
    if (listo) {
      ref.current?.reset();
      if (editar) location.reload();
    }
  }, [listo, editar]);

  return (
    <form ref={ref} action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" defaultValue={editar?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            className="input"
            required
            defaultValue={editar?.nombre ?? ""}
            placeholder="Nombre del cliente"
          />
        </div>
        <div>
          <label className="label" htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            name="telefono"
            className="input"
            inputMode="tel"
            defaultValue={editar?.telefono ?? ""}
            placeholder="999 888 777"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="direccion">Dirección</label>
          <input
            id="direccion"
            name="direccion"
            className="input"
            defaultValue={editar?.direccion ?? ""}
            placeholder="Av. …"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notas">Notas</label>
          <input
            id="notas"
            name="notas"
            className="input"
            defaultValue={editar?.notas ?? ""}
            placeholder="Referencia, interno…"
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
          ✅ Cliente guardado.
        </p>
      )}

      <button type="submit" disabled={pendiente} className="btn btn-primary">
        {pendiente ? "Guardando…" : editar ? "Guardar cambios" : "+ Agregar cliente"}
      </button>
    </form>
  );
}
