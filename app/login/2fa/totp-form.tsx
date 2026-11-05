"use client";

import { useActionState } from "react";
import { _verificar2fa, type EstadoLogin } from "@/app/login/actions";

const inicial: EstadoLogin = {};

export default function TotpForm() {
  const [estado, accion, pendiente] = useActionState(_verificar2fa, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="codigo" className="label">
          Código de 6 dígitos
        </label>
        <input
          id="codigo"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
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
        {pendiente ? "Verificando…" : "Verificar y entrar"}
      </button>
    </form>
  );
}
