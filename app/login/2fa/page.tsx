import Link from "next/link";
import { redirect } from "next/navigation";
import { leerPendiente } from "@/lib/session";
import TotpForm from "./totp-form";

export const metadata = { title: "Verificación en dos pasos" };
export const instant = false;

export default async function Verificar2faPage() {
  const pend = await leerPendiente();
  if (!pend) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-400 to-brand-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg">
            🛡️
          </div>
          <h1 className="text-2xl font-extrabold">Verificación en dos pasos</h1>
          <p className="text-sm text-white/80">
            Abre Google Authenticator y escribe el código.
          </p>
        </div>

        <div className="card flex flex-col gap-4 p-6">
          <TotpForm />

          <div className="border-t border-slate-100 pt-3 text-center">
            <p className="mb-2 text-xs text-slate-500">
              ¿El código no coincide? Revisa que tu celular tenga la{" "}
              <strong>hora automática</strong> activada.
            </p>
            <Link
              href="/login/2fa/configurar"
              className="text-sm font-bold text-brand-600 underline"
            >
              Generar una clave nueva
            </Link>
            <p className="mt-2 text-[11px] text-slate-400">
              Hora del servidor: {new Date().toUTCString()}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
