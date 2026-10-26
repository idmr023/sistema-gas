"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { isoAFecha, moverDias, hoyISO } from "@/lib/dates";
import { notificar } from "@/lib/notify";

export type ResultadoInv = { ok: boolean; error?: string; guardados?: number };

const esquemaFila = z.object({
  marcaId: z.number().int().positive(),
  inicio: z.number().int().min(0),
  comprados: z.number().int().min(0),
  vacios: z.number().int().min(0),
  notas: z.string().trim().max(300),
});

export async function guardarInventario(
  _prev: ResultadoInv,
  formData: FormData,
): Promise<ResultadoInv> {
  await exigirSesion();

  const fecha = String(formData.get("fecha") ?? hoyISO());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "Fecha inválida." };
  }

  const marcas = await prisma.marca.findMany({ where: { activo: true } });
  const filas: z.infer<typeof esquemaFila>[] = [];

  for (const m of marcas) {
    const inicio = formData.get(`inicio_${m.id}`);
    if (inicio === null) continue; // la marca no estaba en el formulario
    const fila = esquemaFila.safeParse({
      marcaId: m.id,
      inicio: Number(inicio) || 0,
      comprados: Number(formData.get(`comprados_${m.id}`)) || 0,
      vacios: Number(formData.get(`vacios_${m.id}`)) || 0,
      notas: String(formData.get(`notas_${m.id}`) ?? ""),
    });
    if (!fila.success) return { ok: false, error: `Datos inválidos para ${m.nombre}.` };
    if (fila.data.vacios > fila.data.inicio + fila.data.comprados) {
      return {
        ok: false,
        error: `${m.nombre}: los vacíos (${fila.data.vacios}) superan inicio + comprados.`,
      };
    }
    filas.push(fila.data);
  }

  const f = isoAFecha(fecha);
  for (const fila of filas) {
    const donde = { fecha_marcaId: { fecha: f, marcaId: fila.marcaId } };
    const existe = await prisma.inventarioDiario.findUnique({ where: donde });
    if (existe) {
      await prisma.inventarioDiario.update({
        where: donde,
        data: { inicio: fila.inicio, comprados: fila.comprados, vacios: fila.vacios, notas: fila.notas },
      });
    } else {
      await prisma.inventarioDiario.create({
        data: { fecha: f, ...fila },
      });
    }
  }

  revalidatePath("/inventario");
  revalidatePath("/reportes");
  return { ok: true, guardados: filas.length };
}

/** Inicio del día = vacíos del día anterior (rellenado de sugerencia). */
export async function inicioDeAyer(fecha: string): Promise<Record<number, number>> {
  await exigirSesion();
  const ayer = moverDias(fecha, -1);
  const registros = await prisma.inventarioDiario.findMany({
    where: { fecha: isoAFecha(ayer) },
    select: { marcaId: true, vacios: true },
  });
  return Object.fromEntries(registros.map((r) => [r.marcaId, r.vacios]));
}

/** Aviso si el cálculo no cuadra con las ventas registradas. */
export async function cuadreDelDia(fecha: string) {
  await exigirSesion();
  const f = isoAFecha(fecha);
  const [inv, ventas] = await Promise.all([
    prisma.inventarioDiario.findMany({ where: { fecha: f } }),
    prisma.venta.groupBy({ by: ["marcaId"], where: { fecha: f }, _sum: { cantidad: true } }),
  ]);
  const ventasPorMarca = new Map(ventas.map((v) => [v.marcaId, v._sum.cantidad ?? 0]));
  return inv.map((r) => ({
    marcaId: r.marcaId,
    calculado: r.inicio + r.comprados - r.vacios,
    registrado: ventasPorMarca.get(r.marcaId) ?? 0,
  }));
}

export async function avisarDescuadre(fecha: string, marca: string, dif: number) {
  await exigirSesion();
  await notificar({
    tipo: "ALERTA",
    titulo: `Descuadre de inventario (${fecha})`,
    mensaje: `${marca}: diferencia de ${dif > 0 ? "+" : ""}${dif} balón(es)`,
    meta: { fecha },
  });
}
