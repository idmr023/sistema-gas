"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordValida, verifyPassword } from "@/lib/password";
import {
  crearPendiente,
  crearSesion,
  destruirPendiente,
  destruirSesion,
  leerPendiente,
} from "@/lib/session";
import { cifrarSecreto, descifrarSecreto, verificarTotp } from "@/lib/totp";

export type EstadoLogin = { error?: string };

type UsuarioConRol = {
  id: number;
  nombre: string;
  rolId: number;
  passwordHash: string;
  mustChangePassword: boolean;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
  activo: boolean;
  rol: {
    nombre: string;
    requiere2fa: boolean;
    puedeLogin: boolean;
    activo: boolean;
  };
};

/** Siguiente paso del flujo de login según el estado del usuario. */
async function avanzar(usuario: UsuarioConRol): Promise<never> {
  if (usuario.mustChangePassword) redirect("/login/cambiar");
  if (usuario.rol.requiere2fa && !usuario.twoFactorEnabled)
    redirect("/login/2fa/configurar");
  if (usuario.rol.requiere2fa) redirect("/login/2fa");
  await crearSesion(usuario.id, usuario.nombre, usuario.rol.nombre, usuario.rolId);
  await destruirPendiente();
  redirect("/dashboard");
}

const selectUsuario = {
  id: true,
  nombre: true,
  rolId: true,
  passwordHash: true,
  mustChangePassword: true,
  twoFactorSecret: true,
  twoFactorEnabled: true,
  activo: true,
  rol: {
    select: { nombre: true, requiere2fa: true, puedeLogin: true, activo: true },
  },
} as const;

async function cargarUsuario(uid: number): Promise<UsuarioConRol | null> {
  return prisma.usuario.findUnique({ where: { id: uid }, select: selectUsuario });
}

async function usuarioDePendiente(): Promise<UsuarioConRol> {
  const pend = await leerPendiente();
  if (!pend) redirect("/login");
  const usuario = await cargarUsuario(pend.uid);
  if (!usuario || !usuario.activo || !usuario.rol.activo) {
    await destruirPendiente();
    redirect("/login");
  }
  return usuario;
}

/* ── 1. Contraseña ───────────────────────────────────────────── */

export async function _login(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!nombre) return { error: "Ingresa tu nombre." };
  if (!password) return { error: "Ingresa la contraseña." };

  const usuario = await prisma.usuario.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, activo: true },
    select: selectUsuario,
  });

  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    return { error: "Nombre o contraseña incorrecto." };
  }
  if (!usuario.rol.activo) return { error: "Tu rol está desactivado." };
  if (!usuario.rol.puedeLogin) {
    return { error: "Este usuario no puede iniciar sesión." };
  }

  await crearPendiente(usuario.id);
  return avanzar(usuario);
}

/* ── 2. Cambio forzado de contraseña ─────────────────────────── */

export async function _cambiarPassword(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const usuario = await usuarioDePendiente();
  if (!usuario.mustChangePassword) return avanzar(usuario);

  const nueva = String(formData.get("nueva") ?? "");
  const repetir = String(formData.get("repetir") ?? "");

  if (!passwordValida(nueva)) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (nueva !== repetir) return { error: "Las contraseñas no coinciden." };
  if (verifyPassword(nueva, usuario.passwordHash)) {
    return { error: "La nueva contraseña no puede ser la actual." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: hashPassword(nueva), mustChangePassword: false },
  });

  return avanzar({ ...usuario, mustChangePassword: false });
}

/* ── 3a. Configurar 2FA (generar secreto + QR) ──────────────── */

/** Idempotente: si aún no hay secreto, lo genera y lo guarda (sin activar). */
export async function preparar2fa(): Promise<{ qr: string; secreto: string } | null> {
  const usuario = await usuarioDePendiente();
  if (!usuario.rol.requiere2fa || usuario.twoFactorEnabled) return null;

  let secreto = descifrarSecreto(usuario.twoFactorSecret);
  if (!secreto) {
    const { generarSecreto } = await import("@/lib/totp");
    secreto = generarSecreto(usuario.nombre);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { twoFactorSecret: cifrarSecreto(secreto) },
    });
  }

  const { urlQr } = await import("@/lib/totp");
  const QRCode = (await import("qrcode")).default;
  const qr = await QRCode.toDataURL(urlQr(usuario.nombre, secreto), { margin: 1, width: 240 });
  return { qr, secreto: "oculto" };
}

/* ── 3b. Verificar código y activar 2FA ─────────────────────── */

export async function _activar2fa(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const usuario = await usuarioDePendiente();
  if (!usuario.rol.requiere2fa) return avanzar(usuario);
  if (usuario.twoFactorEnabled) return avanzar(usuario);

  const codigo = String(formData.get("codigo") ?? "");
  const secreto = descifrarSecreto(usuario.twoFactorSecret);
  if (!secreto) redirect("/login/2fa/configurar");
  if (!verificarTotp(secreto, codigo)) {
    return { error: "Código incorrecto o expirado. Revisa la hora del celular." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { twoFactorEnabled: true },
  });
  return avanzar({ ...usuario, twoFactorEnabled: true });
}

/* ── 3c. Login con 2FA ya activado ──────────────────────────── */

export async function _verificar2fa(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const usuario = await usuarioDePendiente();
  if (usuario.mustChangePassword) redirect("/login/cambiar");
  if (!usuario.rol.requiere2fa || !usuario.twoFactorEnabled) {
    return avanzar(usuario);
  }

  const codigo = String(formData.get("codigo") ?? "");
  const secreto = descifrarSecreto(usuario.twoFactorSecret);
  if (!secreto) redirect("/login/2fa/configurar");
  if (!verificarTotp(secreto, codigo)) {
    return { error: "Código incorrecto o expirado." };
  }

  return avanzar(usuario);
}

/* ── Salir ───────────────────────────────────────────────────── */

export async function _logout(): Promise<void> {
  await destruirSesion();
  redirect("/login");
}
