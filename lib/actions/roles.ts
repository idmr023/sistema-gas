"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermisoApi } from "@/lib/auth";
import { MODULOS } from "@/lib/permisos";

export type ResultadoRol = { ok: boolean; error?: string };

const esquema = z.object({
  id: z.number().int().positive().nullable(),
  nombre: z
    .string()
    .trim()
    .min(1, "Falta el nombre")
    .max(40)
    .regex(/^[A-Za-z0-9_ÁÉÍÓÚÑáéíóúñ ]+$/, "Solo letras, números, espacios y guiones bajos"),
  requiere2fa: z.boolean(),
  puedeLogin: z.boolean(),
  activo: z.boolean(),
  permisos: z.array(z.string()).max(50),
});

export async function guardarRol(
  _prev: ResultadoRol,
  formData: FormData,
): Promise<ResultadoRol> {
  await exigirPermisoApi("roles");

  const permisosForm = formData.getAll("permisos").map(String);
  const clavesValidas = new Set<string>(MODULOS.map((m) => m.clave));

  const parsed = esquema.safeParse({
    id: Number(formData.get("id")) || null,
    nombre: String(formData.get("nombre") ?? "").toUpperCase(),
    requiere2fa: formData.get("requiere2fa") !== null,
    puedeLogin: formData.get("puedeLogin") !== null,
    activo: formData.get("activo") !== null,
    permisos: permisosForm.filter((p) => clavesValidas.has(p)),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { id, ...datos } = parsed.data;

  try {
    if (id) {
      await prisma.rol.update({ where: { id }, data: datos });
    } else {
      await prisma.rol.create({ data: datos });
    }
  } catch {
    return { ok: false, error: "Ya existe un rol con ese nombre." };
  }

  revalidatePath("/roles");
  revalidatePath("/usuarios");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function eliminarRol(id: number): Promise<ResultadoRol> {
  await exigirPermisoApi("roles");

  const rol = await prisma.rol.findUnique({
    where: { id },
    include: { _count: { select: { usuarios: true } } },
  });
  if (!rol) return { ok: false, error: "Rol no encontrado." };
  if (rol.esSistema) {
    return { ok: false, error: "No se pueden eliminar los roles del sistema." };
  }
  if (rol._count.usuarios > 0) {
    return { ok: false, error: "Hay usuarios asignados a este rol." };
  }

  try {
    await prisma.rol.delete({ where: { id } });
  } catch {
    return { ok: false, error: "No se pudo eliminar." };
  }
  revalidatePath("/roles");
  return { ok: true };
}
