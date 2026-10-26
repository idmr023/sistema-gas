"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { normPhone } from "@/lib/phone";

export type ResultadoCliente = { ok: boolean; error?: string; id?: number };

const esquema = z.object({
  id: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1, "Falta el nombre").max(120),
  telefono: z.string().trim().max(30),
  direccion: z.string().trim().max(240),
  notas: z.string().trim().max(400),
});

export async function guardarCliente(
  _prev: ResultadoCliente,
  formData: FormData,
): Promise<ResultadoCliente> {
  await exigirSesion();

  const idNum = Number(formData.get("id")) || null;
  const parsed = esquema.safeParse({
    id: idNum,
    nombre: String(formData.get("nombre") ?? ""),
    telefono: normPhone(formData.get("telefono")),
    direccion: String(formData.get("direccion") ?? ""),
    notas: String(formData.get("notas") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = {
    nombre: parsed.data.nombre,
    telefono: parsed.data.telefono || null,
    direccion: parsed.data.direccion || null,
    notas: parsed.data.notas || null,
  };

  let id: number;
  if (parsed.data.id) {
    const actualizado = await prisma.cliente.update({ where: { id: parsed.data.id }, data });
    id = actualizado.id;
  } else {
    const creado = await prisma.cliente.create({ data });
    id = creado.id;
  }

  revalidatePath("/clientes");
  return { ok: true, id };
}

export async function eliminarCliente(id: number): Promise<ResultadoCliente> {
  await exigirSesion();
  try {
    await prisma.cliente.delete({ where: { id } });
  } catch {
    return { ok: false, error: "No se pudo eliminar (tiene ventas)." };
  }
  revalidatePath("/clientes");
  return { ok: true };
}
