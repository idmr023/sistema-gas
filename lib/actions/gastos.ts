"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermisoApi } from "@/lib/auth";
import { isoAFecha, hoyISO } from "@/lib/dates";
import { num } from "@/lib/money";

export type ResultadoGasto = { ok: boolean; error?: string };

const esquema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(["ALMUERZO", "TRANSPORTE", "MANTENIMIENTO", "OTRO"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  colaboradores: z.string().trim().max(200),
  descripcion: z.string().trim().max(300),
});

export async function guardarGasto(
  _prev: ResultadoGasto,
  formData: FormData,
): Promise<ResultadoGasto> {
  await exigirPermisoApi("gastos");

  const parsed = esquema.safeParse({
    fecha: String(formData.get("fecha") ?? hoyISO()),
    tipo: String(formData.get("tipo") ?? "ALMUERZO"),
    monto: Number(formData.get("monto")) || 0,
    colaboradores: String(formData.get("colaboradores") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const f = isoAFecha(parsed.data.fecha);
  let caja = await prisma.caja.findUnique({ where: { fecha: f } });
  if (!caja) {
    caja = await prisma.caja.create({
      data: { fecha: f, montoApertura: 0, notas: "Caja automática desde gasto" },
    });
  }

  await prisma.gasto.create({
    data: {
      fecha: f,
      cajaId: caja.id,
      tipo: parsed.data.tipo,
      monto: parsed.data.monto,
      colaboradores: parsed.data.colaboradores || null,
      descripcion: parsed.data.descripcion || null,
    },
  });

  revalidatePath("/gastos");
  revalidatePath("/cajas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function eliminarGasto(id: number): Promise<ResultadoGasto> {
  await exigirPermisoApi("gastos");
  try {
    await prisma.gasto.delete({ where: { id } });
  } catch {
    return { ok: false, error: "No se pudo eliminar." };
  }
  revalidatePath("/gastos");
  revalidatePath("/cajas");
  return { ok: true };
}

/** Gastos del día agrupados por tipo. */
export async function gastosDelDia(fecha: string) {
  await exigirPermisoApi("gastos");
  const f = isoAFecha(fecha);
  const gastos = await prisma.gasto.findMany({
    where: { fecha: f },
    orderBy: { createdAt: "desc" },
  });

  const porTipo = new Map<string, number>();
  for (const g of gastos) {
    porTipo.set(g.tipo, (porTipo.get(g.tipo) ?? 0) + num(g.monto));
  }

  return {
    gastos,
    total: gastos.reduce((a, g) => a + num(g.monto), 0),
    porTipo: Object.fromEntries(porTipo),
    almuerzos: gastos.filter((g) => g.tipo === "ALMUERZO"),
    totalAlmuerzos: gastos
      .filter((g) => g.tipo === "ALMUERZO")
      .reduce((a, g) => a + num(g.monto), 0),
  };
}
