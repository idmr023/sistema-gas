"use client";

import { useActionState } from "react";
import { _cambiarPassword, type EstadoLogin } from "@/app/login/actions";

const inicial: EstadoLogin = {};

export default function CambiarPasswordForm() {
  const [estado, accion, pendiente] = useActionState(_cambiarPassword, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nueva" className="label">
          Nueva contraseña
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          autoFocus
          minLength={8}
          maxLength={128}
          placeholder="Mínimo 8 caracteres"
          className={`input ${estado.error ? "input-error" : ""}`}
        />
      </div>

      <div>
        <label htmlFor="repetir" className="label">
          Repite la contraseña
        </label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
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
        {pendiente ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
