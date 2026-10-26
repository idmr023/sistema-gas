"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { _logout } from "@/app/login/actions";

type Item = { href: string; label: string; icon: string; corto?: string };

const secciones: Item[] = [
  { href: "/dashboard", label: "Inicio", icon: "📊", corto: "Inicio" },
  { href: "/ventas", label: "Ventas", icon: "🧾", corto: "Ventas" },
  { href: "/inventario", label: "Inventario", icon: "🛢️", corto: "Inventario" },
  { href: "/reportes", label: "Reportes", icon: "📈", corto: "Reportes" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️", corto: "Ajustes" },
];

const extras: Item[] = [
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/pagos", label: "Pagos", icon: "💰" },
  { href: "/notificaciones", label: "Notificaciones", icon: "🔔" },
];

function activa(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ nombre, rol }: { nombre: string; rol: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-slate-100 p-4 lg:flex">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg shadow">
          🔥
        </span>
        <span className="text-lg font-extrabold tracking-tight">Sistema de Gas</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {[...secciones, ...extras].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${activa(pathname, item.href) ? "nav-link-active" : ""}`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
        <p className="truncate text-sm font-bold">{nombre}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {rol}
        </p>
        <form action={_logout}>
          <button type="submit" className="btn btn-ghost btn-sm mt-2 w-full">
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {secciones.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-bold ${
              activa(pathname, item.href)
                ? "text-brand-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.corto}
          </Link>
        ))}
      </div>
    </nav>
  );
}
