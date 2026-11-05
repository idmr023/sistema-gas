"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermisoApi } from "@/lib/auth";

export type ResultadoCfg = { ok: boolean; error?: string };

/** Claves que el formulario puede modificar (lista corta = no se cuela otra). */
const CLAVES = [
  "nombre_negocio",
  "telefono_negocio",
  "direccion_negocio",
  "yape_numero",
  "yape_titular",
  "telegram_bot_token",
  "telegram_chat_id",
  "imap_enabled",
  "imap_host",
  "imap_port",
  "imap_user",
  "imap_pass",
  "imap_folder",
  "sonido_yape",
] as const;

const esquema = z.record(
  z.string(),
  z.string().max(500),
);

export async function guardarConfig(
  _prev: ResultadoCfg,
  formData: FormData,
): Promise<ResultadoCfg> {
  await exigirPermisoApi("configuracion");

  const datos: Record<string, string> = {};
  for (const clave of CLAVES) {
    const v = formData.get(clave);
    if (v !== null) datos[clave] = String(v).trim();
  }

  // Casillas sin marcar llegan ausentes: solo se normalizan dentro de su grupo.
  const grupo = String(formData.get("grupo") ?? "");
  if (grupo === "imap" && !("imap_enabled" in datos)) datos.imap_enabled = "0";
  if (grupo === "notificaciones" && !("sonido_yape" in datos)) datos.sonido_yape = "0";

  const parsed = esquema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Valores demasiado largos." };

  for (const [clave, valor] of Object.entries(parsed.data)) {
    await prisma.config.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
  }

  revalidatePath("/configuracion");
  return { ok: true };
}

/* ── Marcas ─────────────────────────────────────────── */

const esquemaMarca = z.object({
  id: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1, "Falta el nombre").max(60),
  precioDefecto: z.number().min(0).max(99999),
  activo: z.boolean(),
});

export async function guardarMarca(
  _prev: ResultadoCfg,
  formData: FormData,
): Promise<ResultadoCfg> {
  await exigirPermisoApi("configuracion");

  const parsed = esquemaMarca.safeParse({
    id: Number(formData.get("id")) || null,
    nombre: String(formData.get("nombre") ?? ""),
    precioDefecto: Number(formData.get("precioDefecto")) || 0,
    activo: formData.get("activo") !== null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { id, ...datos } = parsed.data;
  try {
    if (id) {
      await prisma.marca.update({ where: { id }, data: datos });
    } else {
      await prisma.marca.create({ data: datos });
    }
  } catch {
    return { ok: false, error: "Ya existe una marca con ese nombre." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function eliminarMarca(id: number): Promise<ResultadoCfg> {
  await exigirPermisoApi("configuracion");
  try {
    await prisma.marca.update({ where: { id }, data: { activo: false } });
  } catch {
    return { ok: false, error: "No se pudo desactivar." };
  }
  revalidatePath("/configuracion");
  return { ok: true };
}

/* ── Repartidores ───────────────────────────────────── */

const esquemaRep = z.object({
  id: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1, "Falta el nombre").max(60),
  telefono: z.string().trim().max(30),
  activo: z.boolean(),
});

export async function guardarRepartidor(
  _prev: ResultadoCfg,
  formData: FormData,
): Promise<ResultadoCfg> {
  await exigirPermisoApi("configuracion");

  const parsed = esquemaRep.safeParse({
    id: Number(formData.get("id")) || null,
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    activo: formData.get("activo") !== null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { id, ...datos } = parsed.data;
  try {
    if (id) {
      await prisma.repartidor.update({ where: { id }, data: datos });
    } else {
      await prisma.repartidor.create({ data: datos });
    }
  } catch {
    return { ok: false, error: "Ya existe un repartidor con ese nombre." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function eliminarRepartidor(id: number): Promise<ResultadoCfg> {
  await exigirPermisoApi("configuracion");
  try {
    await prisma.repartidor.update({ where: { id }, data: { activo: false } });
  } catch {
    return { ok: false, error: "No se pudo desactivar." };
  }
  revalidatePath("/configuracion");
  return { ok: true };
}
