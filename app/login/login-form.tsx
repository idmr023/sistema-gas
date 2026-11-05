"use client";

import { useActionState } from "react";
import { _login, type EstadoLogin } from "@/app/login/actions";

const inicial: EstadoLogin = {};

export default function LoginForm() {
  const [estado, accion, pendiente] = useActionState(_login, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nombre" className="label">
          Nombre de usuario
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="username"
          autoFocus
          maxLength={60}
          placeholder="Tu nombre"
          className={`input ${estado.error ? "input-error" : ""}`}
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pendiente ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
