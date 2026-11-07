import "server-only";
import "./env";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const COOKIE = "gas_session";
const COOKIE_PEND = "gas_pend";
const DURACION = 30 * 24 * 3600 * 1000; // 30 días
const DURACION_PEND = 15 * 60 * 1000; // 15 minutos (flujo de login)

export type Sesion = {
  id: number;
  nombre: string;
  rol: string;
  rolId: number;
  exp: number;
};

/** Estado intermedio del login (cambiar contraseña / 2FA). */
export type Pendiente = {
  uid: number;
  exp: number;
};

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en .env");
  return s;
}

function firmar(body: string): string {
  return crypto.createHmac("sha256", secreto()).update(body).digest("base64url");
}

function firmarToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${firmar(body)}`;
}

async function verificar<T>(token: string | undefined): Promise<T | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    await connection();
    const esperado = firmar(body);
    if (sig.length !== esperado.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & {
      exp?: number;
    };
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function crearSesion(
  id: number,
  nombre: string,
  rol: string,
  rolId: number,
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, firmarToken({ id, nombre, rol, rolId, exp: Date.now() + DURACION }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION / 1000,
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const s = await verificar<Sesion>(store.get(COOKIE)?.value);
  // Cookies de versiones antiguas (sin rolId) o manipuladas → sesión inválida,
  // que el guard la trate como "sin sesión" y mande a /login.
  if (!s || typeof s.id !== "number" || typeof s.rolId !== "number") return null;
  return s;
}

export async function destruirSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
  store.delete(COOKIE_PEND);
}

/* ── Login pendiente (entre pasos: contraseña → 2FA) ─────────── */

export async function crearPendiente(uid: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_PEND, firmarToken({ uid, exp: Date.now() + DURACION_PEND }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_PEND / 1000,
  });
}

export async function leerPendiente(): Promise<Pendiente | null> {
  const store = await cookies();
  const p = await verificar<Pendiente>(store.get(COOKIE_PEND)?.value);
  if (!p || typeof p.uid !== "number") return null;
  return p;
}

export async function destruirPendiente(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_PEND);
}
