import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gas_session";
const DURACION = 30 * 24 * 3600 * 1000; // 30 días

export type Sesion = {
  nombre: string;
  rol: string;
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

export function firmarSesion(data: Omit<Sesion, "exp">): string {
  const payload: Sesion = { ...data, exp: Date.now() + DURACION };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${firmar(body)}`;
}

function verificar(token: string | undefined): Sesion | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    const esperado = firmar(body);
    if (sig.length !== esperado.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Sesion;
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function crearSesion(nombre: string, rol: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, firmarSesion({ nombre, rol }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION / 1000,
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const store = await cookies();
  return verificar(store.get(COOKIE)?.value);
}

export async function destruirSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
