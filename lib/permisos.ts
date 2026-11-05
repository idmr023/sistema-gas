/** Módulos con permiso propio (tabla roles.permisos). */
export const MODULOS = [
  { clave: "ventas", label: "Ventas", icon: "🧾" },
  { clave: "pagos", label: "Pagos", icon: "💰" },
  { clave: "clientes", label: "Clientes (contactos)", icon: "👥" },
  { clave: "inventario", label: "Inventario", icon: "🛢️" },
  { clave: "cajas", label: "Cajas", icon: "💵" },
  { clave: "gastos", label: "Gastos", icon: "💸" },
  { clave: "reportes", label: "Reportes", icon: "📈" },
  { clave: "configuracion", label: "Configuración", icon: "⚙️" },
  { clave: "usuarios", label: "Usuarios", icon: "👤" },
  { clave: "roles", label: "Roles", icon: "🔐" },
] as const;

export type ModuloClave = (typeof MODULOS)[number]["clave"];
