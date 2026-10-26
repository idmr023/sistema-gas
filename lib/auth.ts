import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { leerSesion, type Sesion } from "./session";

/** Devuelve la sesión actual (memoizada por render). */
export const getSesion = cache(async (): Promise<Sesion | null> => leerSesion());

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
