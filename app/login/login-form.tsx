"use client";

import { useActionState } from "react";
import { _login, type EstadoLogin } from "@/app/login/actions";

const inicial: EstadoLogin = {};

export default function LoginForm() {
  const [estado, accion, pendiente] = useActionState(_login, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="pin" className="label">
          PIN de acceso
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          placeholder="••••"
          className={`input text-center text-2xl tracking-[0.5em] ${
            estado.error ? "input-error" : ""
          }`}
        />
      </div>

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="btn btn-primary w-full">
        {pendiente ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
