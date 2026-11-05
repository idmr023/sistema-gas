"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermisoApi } from "@/lib/auth";
import { isoAFecha, hoyISO } from "@/lib/dates";
import { num } from "@/lib/money";

export type ResultadoCaja = { ok: boolean; error?: string };

const esquemaApertura = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoApertura: z.number().min(0),
  notas: z.string().trim().max(300),
});

export async function abrirCaja(
  _prev: ResultadoCaja,
  formData: FormData,
): Promise<ResultadoCaja> {
  const sesion = await exigirPermisoApi("cajas");

  const parsed = esquemaApertura.safeParse({
    fecha: String(formData.get("fecha") ?? hoyISO()),
    montoApertura: Number(formData.get("montoApertura")) || 0,
    notas: String(formData.get("notas") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const existe = await prisma.caja.findUnique({
    where: { fecha: isoAFecha(parsed.data.fecha) },
  });
  if (existe) return { ok: false, error: "Ya existe una caja abierta para esa fecha." };

  await prisma.caja.create({
    data: {
      fecha: isoAFecha(parsed.data.fecha),
      montoApertura: parsed.data.montoApertura,
      notas: parsed.data.notas,
      usuarioId: (sesion as { id?: number }).id ?? null,
    },
  });

  revalidatePath("/cajas");
  revalidatePath("/dashboard");
  return { ok: true };
}

const esquemaCierre = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoCierre: z.number().min(0),
  notas: z.string().trim().max(300),
});

export async function cerrarCaja(
  _prev: ResultadoCaja,
  formData: FormData,
): Promise<ResultadoCaja> {
  await exigirPermisoApi("cajas");

  const parsed = esquemaCierre.safeParse({
    fecha: String(formData.get("fecha") ?? hoyISO()),
    montoCierre: Number(formData.get("montoCierre")) || 0,
    notas: String(formData.get("notas") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const caja = await prisma.caja.findUnique({
    where: { fecha: isoAFecha(parsed.data.fecha) },
  });
  if (!caja) return { ok: false, error: "No hay caja abierta para esa fecha." };
  if (caja.estado === "CERRADA") return { ok: false, error: "La caja ya está cerrada." };

  await prisma.caja.update({
    where: { id: caja.id },
    data: {
      montoCierre: parsed.data.montoCierre,
      notas: parsed.data.notas || caja.notas,
      estado: "CERRADA",
    },
  });

  revalidatePath("/cajas");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Resumen de caja: apertura + ventas en efectivo − gastos = esperado en cierre. */
export async function resumenCaja(fecha: string) {
  await exigirPermisoApi("cajas");
  const f = isoAFecha(fecha);

  const [caja, gastos, pagosEfectivo] = await Promise.all([
    prisma.caja.findUnique({ where: { fecha: f } }),
    prisma.gasto.findMany({ where: { fecha: f } }),
    prisma.pago.aggregate({
      where: { fecha: f, metodo: "EFECTIVO", estado: "CONFIRMADO" },
      _sum: { monto: true },
    }),
  ]);

  const totalGastos = gastos.reduce((a, g) => a + num(g.monto), 0);
  const efectivoCobrado = num(pagosEfectivo._sum.monto);
  const apertura = caja ? num(caja.montoApertura) : 0;
  const cierre = caja?.montoCierre !== null && caja?.montoCierre !== undefined ? num(caja.montoCierre) : null;
  const esperado = apertura + efectivoCobrado - totalGastos;

  return {
    caja,
    gastos,
    apertura,
    efectivoCobrado,
    totalGastos,
    cierre,
    esperado,
    diferencia: cierre !== null ? cierre - esperado : null,
    estado: caja?.estado ?? null,
  };
}
