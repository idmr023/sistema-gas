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

/** Datos que necesita la pantalla de 2FA. */
export type Datos2fa = {
  /** QR en base64 (vacío si la clave activa no debe mostrarse). */
  qr: string;
  /** true = el 2FA ya está activo y hay que reconfigurarlo. */
  activo: boolean;
  mensaje?: string;
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
  if (!nombre) return { error: "Ingresa tu nombre de usuario o correo." };
  if (!password) return { error: "Ingresa la contraseña." };

  // Se acepta el nombre de usuario o el correo registrado (el nombre tiene
  // prioridad: muchos usuarios escriben su correo sin saber que no es el campo).
  const usuario =
    (await prisma.usuario.findFirst({
      where: { nombre: { equals: nombre, mode: "insensitive" }, activo: true },
      select: selectUsuario,
    })) ??
    (await prisma.usuario.findFirst({
      where: { email: { equals: nombre, mode: "insensitive" }, activo: true },
      select: selectUsuario,
    }));

  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    // Mismo mensaje para usuario inexistente y contraseña incorrecta (no se
    // revela qué cuentas existen). Se aclara que se acepta nombre o correo.
    return {
      error: "Usuario o contraseña incorrectos. Puedes entrar con tu nombre o tu correo.",
    };
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

async function qrDe(nombre: string, secreto: string): Promise<string> {
  const { urlQr } = await import("@/lib/totp");
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(urlQr(nombre, secreto), { margin: 1, width: 240 });
}

/**
 * Datos para la pantalla de 2FA.
 * - Si el 2FA no está activo, devuelve el QR con la clave (la genera si falta).
 * - Si ya está activo, no expone el QR: hay que reconfigurar (pide contraseña).
 */
export async function preparar2fa(): Promise<Datos2fa | null> {
  const usuario = await usuarioDePendiente();
  if (!usuario.rol.requiere2fa) return null;

  const { generarSecreto } = await import("@/lib/totp");
  let secreto = descifrarSecreto(usuario.twoFactorSecret);

  // Hay clave guardada pero no se puede leer (cambió AUTH_SECRET): hay que
  // reasignarla, no se puede validar ningún código con ella.
  if (!secreto && usuario.twoFactorSecret) {
    return {
      qr: "",
      activo: true,
      mensaje:
        "No pudimos leer tu clave de 2FA. Genera una clave nueva y escanéala otra vez.",
    };
  }

  // Primera vez: se genera y guarda la clave.
  if (!secreto) {
    secreto = generarSecreto(usuario.nombre);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { twoFactorSecret: cifrarSecreto(secreto) },
    });
  }

  if (usuario.twoFactorEnabled) {
    return {
      qr: "",
      activo: true,
      mensaje:
        "Tu 2FA ya está activo. Si el código no coincide (cambiaste de celular o se desajustó la hora), genera una clave nueva.",
    };
  }

  return { qr: await qrDe(usuario.nombre, secreto), activo: false };
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
  if (!secreto) {
    return {
      error:
        "No pudimos leer tu clave de 2FA. Genera una clave nueva para continuar.",
    };
  }
  if (!verificarTotp(secreto, codigo)) {
    return {
      error:
        "Código incorrecto o expirado. Revisa la hora del celular (activa la hora automática) o genera una clave nueva.",
    };
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
  if (!secreto) {
    return {
      error:
        "No pudimos leer tu clave de 2FA. Genera una clave nueva para continuar.",
    };
  }
  if (!verificarTotp(secreto, codigo)) {
    return {
      error:
        "Código incorrecto o expirado. Revisa la hora del celular (activa la hora automática) o genera una clave nueva.",
    };
  }

  // Código correcto: ya no hay pasos pendientes → sesión completa.
  await crearSesion(usuario.id, usuario.nombre, usuario.rol.nombre, usuario.rolId);
  await destruirPendiente();
  redirect("/dashboard");
}

/* ── 3d. Reconfigurar 2FA (clave nueva) ─────────────────────── */

/**
 * Genera una clave 2FA nueva. Exige la contraseña actual para que una sesión
 * pendiente (por ejemplo, robada) no pueda quedarse con el 2FA del usuario.
 */
export async function _reiniciar2fa(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const usuario = await usuarioDePendiente();
  if (!usuario.rol.requiere2fa) {
    return { error: "Tu rol no requiere 2FA." };
  }

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Ingresa tu contraseña." };
  if (!verifyPassword(password, usuario.passwordHash)) {
    return { error: "Contraseña incorrecta." };
  }

  const { generarSecreto } = await import("@/lib/totp");
  const secreto = generarSecreto(usuario.nombre);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      twoFactorSecret: cifrarSecreto(secreto),
      twoFactorEnabled: false,
    },
  });

  redirect("/login/2fa/configurar");
}

/* ── Salir ───────────────────────────────────────────────────── */

export async function _logout(): Promise<void> {
  await destruirSesion();
  redirect("/login");
}
