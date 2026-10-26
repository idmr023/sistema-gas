import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { marcarLeidas } from "@/lib/actions/notificaciones";

export const metadata = { title: "Notificaciones" };

const ICONOS: Record<string, string> = {
  INFO: "🔔",
  VENTA: "🧾",
  YAPE: "🟣",
  ALERTA: "⚠️",
};

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const filtro = (Array.isArray(sp.f) ? sp.f[0] : sp.f) || "";

  const items = await prisma.notificacion.findMany({
    where: filtro === "nuevas" ? { leida: false } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Notificaciones</h1>
          <p className="text-sm text-slate-500">{items.length} aviso(s) recientes</p>
        </div>
        <div className="flex gap-2">
          <a href="/notificaciones?f=nuevas" className="btn btn-ghost btn-sm">
            Solo nuevas
          </a>
          <a href="/notificaciones" className="btn btn-ghost btn-sm">
            Todas
          </a>
          <form
            action={async () => {
              "use server";
              await marcarLeidas();
            }}
          >
            <button className="btn btn-primary btn-sm">✓ Marcar leídas</button>
          </form>
        </div>
      </div>

      <div className="card p-0">
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No hay notificaciones{filtro === "nuevas" ? " nuevas" : ""}.
          </p>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${
                n.leida ? "opacity-60" : ""
              }`}
            >
              <span className="text-lg">{ICONOS[n.tipo] ?? "🔔"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{n.titulo}</p>
                {n.mensaje && <p className="text-xs text-slate-600">{n.mensaje}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">
                {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
