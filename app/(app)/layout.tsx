import { exigirSesion } from "@/lib/auth";
import { Sidebar, BottomNav } from "@/components/nav";
import Notificaciones from "@/components/notificaciones";

// Este bloque lee la sesión (cookie) y datos de la BD en cada petición:
// se permite que la ruta bloquee en el servidor (Next 16 + cacheComponents).
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirSesion();

  return (
    <div>
      <Sidebar nombre={sesion.nombre} rol={sesion.rol} />

      <div className="flex min-h-dvh flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm shadow">
              🔥
            </span>
            <span className="text-sm font-extrabold">Sistema de Gas</span>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm font-bold text-slate-600">
              {sesion.nombre}
            </span>
            <span className="badge badge-slate">{sesion.rol}</span>
          </div>

          <Notificaciones />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 lg:pb-10">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
