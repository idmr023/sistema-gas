import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata = { title: "Iniciar sesión" };
export const instant = false;

export default async function LoginPage() {
  const sesion = await getSesion();
  if (sesion) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-400 to-brand-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg">
            🔥
          </div>
          <h1 className="text-2xl font-extrabold">Sistema de Gas</h1>
          <p className="text-sm text-white/80">
            Ventas, inventario y pagos del negocio
          </p>
        </div>

        <div className="card p-6">
          <LoginForm />
          <p className="mt-4 text-center text-xs text-slate-400">
            PIN inicial: 1234 — cámbialo en Configuración
          </p>
        </div>
      </div>
    </main>
  );
}
