import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { leerSesion, type Sesion } from "./session";

/** Devuelve la sesión actual (memoizada por render). */
export const getSesion = cache(async (): Promise<Sesion | null> => leerSesion());

/** Rol vigente desde la BD (memoizado por render) — los cambios aplican de inmediato. */
export const getRol = cache(async (rolId: number) =>
  prisma.rol.findUnique({ where: { id: rolId } }),
);

/** Permisos del rol vigente (memoizado por render). */
export const getPermisos = cache(async (rolId: number): Promise<string[]> => {
  if (!Number.isInteger(rolId) || rolId <= 0) return [];
  const rol = await getRol(rolId);
  if (!rol || !rol.activo) return [];
  return Array.isArray(rol.permisos) ? (rol.permisos as string[]) : [];
});

async function tienePermiso(sesion: Sesion, permiso: string): Promise<boolean> {
  const permisos = await getPermisos(sesion.rolId);
  return permisos.includes(permiso);
}

/** Protege una página: si no hay sesión válida, redirige a /login. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

/** Protege una Server Action: lanza 401 si no hay sesión. */
export async function exigirSesionApi(): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) throw new Error("NO_AUTH");
  return sesion;
}

/** Protege una página por permiso de módulo (tabla roles.permisos). */
export async function exigirPermiso(permiso: string): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (!(await tienePermiso(sesion, permiso))) redirect("/dashboard");
  return sesion;
}

/** Protege una Server Action por permiso de módulo. */
export async function exigirPermisoApi(permiso: string): Promise<Sesion> {
  const sesion = await exigirSesionApi();
  if (!(await tienePermiso(sesion, permiso))) throw new Error("FORBIDDEN");
  return sesion;
}

/** Protege una página: exige al menos uno de los permisos dados. */
export async function exigirPermisoAlguno(...permisos: string[]): Promise<Sesion> {
  const sesion = await exigirSesion();
  const mios = await getPermisos(sesion.rolId);
  if (!permisos.some((p) => mios.includes(p))) redirect("/dashboard");
  return sesion;
}

/** Protege una Server Action: exige al menos uno de los permisos dados. */
export async function exigirPermisoApiAlguno(...permisos: string[]): Promise<Sesion> {
  const sesion = await exigirSesionApi();
  const mios = await getPermisos(sesion.rolId);
  if (!permisos.some((p) => mios.includes(p))) throw new Error("FORBIDDEN");
  return sesion;
}
