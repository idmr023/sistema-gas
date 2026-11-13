"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermisoApi, exigirSesionApi } from "@/lib/auth";
import { hashPassword, passwordValida } from "@/lib/password";

export type ResultadoUsuario = { ok: boolean; error?: string };

const esquema = z.object({
  id: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1, "Falta el nombre").max(60),
  email: z.email("Correo inválido").max(120, "Máximo 120 caracteres"),
  rolId: z.number().int().positive("Elige un rol"),
  telefono: z.string().trim().max(30),
  activo: z.boolean(),
  password: z.string(),
});

export async function guardarUsuario(
  _prev: ResultadoUsuario,
  formData: FormData,
): Promise<ResultadoUsuario> {
  const sesion = await exigirPermisoApi("usuarios");

  const parsed = esquema.safeParse({
    id: Number(formData.get("id")) || null,
    nombre: String(formData.get("nombre") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    rolId: Number(formData.get("rolId")) || 0,
    telefono: String(formData.get("telefono") ?? ""),
    activo: formData.get("activo") !== null,
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, password, ...datos } = parsed.data;

  if (id && id === sesion.id && !datos.activo) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }

  try {
    if (id) {
      const data: Record<string, unknown> = { ...datos };
      if (password) {
        if (!passwordValida(password)) {
          return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
        }
        data.passwordHash = hashPassword(password);
        data.mustChangePassword = true; // el usuario deberá cambiarla al entrar
      }
      await prisma.usuario.update({ where: { id }, data });
    } else {
      if (!passwordValida(password)) {
        return { ok: false, error: "La contraseña inicial debe tener al menos 8 caracteres." };
      }
      await prisma.usuario.create({
        data: {
          ...datos,
          passwordHash: hashPassword(password),
          mustChangePassword: true,
        },
      });
    }
  } catch (e) {
    const texto = String((e as { meta?: unknown })?.meta ?? "") + " " + String((e as { message?: string })?.message ?? "");
    if (/email/i.test(texto)) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    return { ok: false, error: "Ya existe un usuario con ese nombre." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function eliminarUsuario(id: number): Promise<ResultadoUsuario> {
  const sesion = await exigirPermisoApi("usuarios");
  if (id === sesion.id) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }

  const count = await prisma.usuario.count({ where: { activo: true } });
  if (count <= 1) return { ok: false, error: "No puedes eliminar el último usuario activo." };

  try {
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
  } catch {
    return { ok: false, error: "No se pudo desactivar." };
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

/**
 * Borra la clave 2FA del usuario: podrá configurarla de nuevo al entrar
 * (útil si perdió el celular, cambió de app o la hora del reloj lo bloqueó).
 */
export async function restablecer2fa(id: number): Promise<ResultadoUsuario> {
  await exigirPermisoApi("usuarios");

  try {
    await prisma.usuario.update({
      where: { id },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });
  } catch {
    return { ok: false, error: "No se pudo restablecer el 2FA." };
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function listarUsuarios() {
  await exigirSesionApi();
  return prisma.usuario.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      email: true,
      rolId: true,
      rol: { select: { nombre: true } },
      telefono: true,
      activo: true,
      twoFactorEnabled: true,
    },
  });
}
