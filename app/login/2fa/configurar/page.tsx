import { redirect } from "next/navigation";
import { leerPendiente } from "@/lib/session";
import { preparar2fa } from "@/app/login/actions";
import Activar2faForm from "./activar-form";

export const metadata = { title: "Configurar 2FA" };
export const instant = false;

export default async function Configurar2faPage() {
  const pend = await leerPendiente();
  if (!pend) redirect("/login");

  const datos = await preparar2fa();
  if (!datos) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-400 to-brand-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg">
            📱
          </div>
          <h1 className="text-2xl font-extrabold">Configura tu 2FA</h1>
          <p className="text-sm text-white/80">
            Es obligatorio para tu rol. Solo se hace una vez.
          </p>
        </div>

        <div className="card flex flex-col gap-4 p-6">
          <ol className="flex flex-col gap-2 text-sm text-slate-600">
            <li>
              <strong>1.</strong> Abre Google Authenticator (o similar) en tu celular.
            </li>
            <li>
              <strong>2.</strong> Escanea este código QR:
            </li>
          </ol>

          <div className="flex justify-center rounded-xl bg-white p-3 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={datos.qr}
              alt="Código QR para configurar Google Authenticator"
              width={240}
              height={240}
            />
          </div>

          <p className="text-center text-xs text-slate-500">
            Si no puedes escanear, ingresa la clave manualmente en la app.
          </p>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-600">
              3. Escribe el código que muestra la app:
            </p>
            <Activar2faForm />
          </div>
        </div>
      </div>
    </main>
  );
}
