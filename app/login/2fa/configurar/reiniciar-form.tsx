"use client";

import { useActionState } from "react";
import { _reiniciar2fa, type EstadoLogin } from "@/app/login/actions";

const inicial: EstadoLogin = {};

export default function Reiniciar2faForm() {
  const [estado, accion, pendiente] = useActionState(_reiniciar2fa, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="label">
          Tu contraseña actual
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="••••••••"
          className={`input ${estado.error ? "input-error" : ""}`}
        />
      </div>

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="btn btn-primary w-full">
        {pendiente ? "Generando…" : "Generar clave nueva"}
      </button>
    </form>
  );
}
