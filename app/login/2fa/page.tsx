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

        <div className="card p-6">
          <TotpForm />
        </div>
      </div>
    </main>
  );
}
