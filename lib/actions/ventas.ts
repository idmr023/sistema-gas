"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/notify";
import { exigirSesion } from "@/lib/auth";
import { isoAFecha, hoyISO } from "@/lib/dates";
import { num, r2 } from "@/lib/money";
import { normPhone } from "@/lib/phone";

export type Resultado = { ok: boolean; error?: string; id?: number };

const esquemaVenta = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  clienteNombre: z.string().trim().max(120),
  direccion: z.string().trim().max(240),
  telefono: z.string().trim().max(30),
  clienteId: z.number().int().positive().nullable(),
  premium: z.boolean(),
  marcaId: z.number().int().positive().nullable(),
  cantidad: z.number().int().min(1).max(999),
  valorUnitario: z.number().min(0).max(99999),
  total: z.number().min(0),
  aCuenta: z.number().min(0),
  prestado: z.boolean(),
  regresado: z.boolean(),
  repartidorId: z.number().int().positive().nullable(),
  notas: z.string().trim().max(500),
  metodoPago: z.enum(["EFECTIVO", "YAPE", "TRANSFERENCIA", "OTRO"]),
});

const esquemaPago = z.object({
  ventaId: z.number().int().positive(),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  metodo: z.enum(["EFECTIVO", "YAPE", "TRANSFERENCIA", "OTRO"]),
  referencia: z.string().trim().max(80),
  nota: z.string().trim().max(300),
});

function entero(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

function leerVenta(fd: FormData) {
  const cantidad = Number(fd.get("cantidad") ?? 1);
  const valorUnitario = num(fd.get("valorUnitario"));
  const raw = {
    fecha: String(fd.get("fecha") ?? hoyISO()),
    clienteNombre: String(fd.get("clienteNombre") ?? ""),
    direccion: String(fd.get("direccion") ?? ""),
    telefono: String(fd.get("telefono") ?? ""),
    clienteId: entero(fd.get("clienteId")),
    premium: fd.get("premium") !== null,
    marcaId: entero(fd.get("marcaId")),
    cantidad,
    valorUnitario,
    total: r2(cantidad * valorUnitario),
    aCuenta: num(fd.get("aCuenta")),
    prestado: fd.get("prestado") !== null,
    regresado: fd.get("regresado") !== null,
    repartidorId: entero(fd.get("repartidorId")),
    notas: String(fd.get("notas") ?? ""),
    metodoPago: String(fd.get("metodoPago") ?? "EFECTIVO") as
      | "EFECTIVO"
      | "YAPE"
      | "TRANSFERENCIA"
      | "OTRO",
  };
  return esquemaVenta.parse(raw);
}

/** Busca (o crea) el cliente por teléfono / nombre. */
async function resolverCliente(v: {
  clienteId: number | null;
  clienteNombre: string;
  direccion: string;
  telefono: string;
}): Promise<number | null> {
  const telefono = normPhone(v.telefono);

  if (v.clienteId) {
    const existe = await prisma.cliente.findUnique({ where: { id: v.clienteId } });
    if (existe) return existe.id;
  }

  if (telefono) {
    const porTel = await prisma.cliente.findFirst({
      where: { telefono: { contains: telefono, mode: "insensitive" } },
    });
    if (porTel) {
      await prisma.cliente.update({
        where: { id: porTel.id },
        data: {
          nombre: v.clienteNombre || porTel.nombre,
          direccion: v.direccion || porTel.direccion,
        },
      });
      return porTel.id;
    }
  }

  if (v.clienteNombre.trim()) {
    const creado = await prisma.cliente.create({
      data: {
        nombre: v.clienteNombre,
        direccion: v.direccion || null,
        telefono: v.telefono || null,
      },
    });
    return creado.id;
  }

  return null;
}

/** Recalcula a_cuenta / saldo / estado a partir de los pagos confirmados. */
async function recalcular(ventaId: number) {
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return null;
  const suma = await prisma.pago.aggregate({
    where: { ventaId, estado: "CONFIRMADO" },
    _sum: { monto: true },
  });
  const pagado = num(suma._sum.monto);
  const total = num(venta.total);
  const saldo = r2(Math.max(total - pagado, 0));
  const estado = pagado <= 0 ? "PENDIENTE" : saldo <= 0 ? "PAGADO" : "PARCIAL";
  return prisma.venta.update({
    where: { id: ventaId },
    data: { aCuenta: pagado, saldo, estado },
    include: { marca: true, repartidor: true, cliente: true },
  });
}

export async function crearVenta(
  _prev: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSesion();

  let datos: z.infer<typeof esquemaVenta>;
  try {
    datos = leerVenta(formData);
  } catch {
    return { ok: false, error: "Revisa los datos de la venta." };
  }

  if (datos.aCuenta > datos.total) {
    return { ok: false, error: "Lo pagado a cuenta no puede superar el total." };
  }

  const clienteId = await resolverCliente(datos);

  const venta = await prisma.venta.create({
    data: {
      fecha: isoAFecha(datos.fecha),
      clienteId,
      clienteNombre: datos.clienteNombre || null,
      direccion: datos.direccion || null,
      telefono: datos.telefono || null,
      premium: datos.premium,
      marcaId: datos.marcaId,
      cantidad: datos.cantidad,
      valorUnitario: datos.valorUnitario,
      total: datos.total,
      aCuenta: 0,
      saldo: datos.total,
      prestado: datos.prestado,
      regresado: datos.regresado,
      repartidorId: datos.repartidorId,
      notas: datos.notas || null,
    },
  });

  if (datos.aCuenta > 0) {
    await prisma.pago.create({
      data: {
        fecha: isoAFecha(datos.fecha),
        ventaId: venta.id,
        monto: datos.aCuenta,
        metodo: datos.metodoPago,
        origen: "MANUAL",
        nota: "Pago inicial",
      },
    });
  }

  const final = await recalcular(venta.id);

  await notificar({
    tipo: "VENTA",
    titulo: `Nueva venta: ${datos.cantidad} balón(es)`,
    mensaje: [
      final?.clienteNombre || datos.clienteNombre || "Mostrador",
      final?.marca?.nombre ?? "sin marca",
      `Total S/ ${r2(datos.total).toFixed(2)}`,
      final && num(final.saldo) > 0 ? `Saldo S/ ${num(final.saldo).toFixed(2)}` : "Pagado",
    ].join(" · "),
    meta: { ventaId: venta.id, total: datos.total, saldo: final?.saldo },
  });

  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return { ok: true, id: venta.id };
}

export async function registrarPago(
  _prev: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSesion();

  const raw = {
    ventaId: Number(formData.get("ventaId")),
    monto: num(formData.get("monto")),
    metodo: String(formData.get("metodo") ?? "EFECTIVO"),
    referencia: String(formData.get("referencia") ?? ""),
    nota: String(formData.get("nota") ?? ""),
  };

  const parsed = esquemaPago.safeParse({
    ...raw,
    metodo: raw.metodo as "EFECTIVO" | "YAPE" | "TRANSFERENCIA" | "OTRO",
  });
  if (!parsed.success) return { ok: false, error: "Monto o método inválido." };

  const venta = await prisma.venta.findUnique({
    where: { id: parsed.data.ventaId },
    include: { marca: true },
  });
  if (!venta) return { ok: false, error: "Venta no encontrada." };

  const saldo = num(venta.saldo);
  if (parsed.data.monto > saldo + 0.001) {
    return { ok: false, error: `El pago supera el saldo (S/ ${saldo.toFixed(2)}).` };
  }

  await prisma.pago.create({
    data: {
      fecha: isoAFecha(hoyISO()),
      ventaId: venta.id,
      monto: parsed.data.monto,
      metodo: parsed.data.metodo,
      referencia: parsed.data.referencia || null,
      nota: parsed.data.nota || null,
      origen: "MANUAL",
      estado: "CONFIRMADO",
    },
  });

  const final = await recalcular(venta.id);

  if (parsed.data.metodo === "YAPE") {
    await notificar({
      tipo: "YAPE",
      titulo: `Pago Yape: S/ ${parsed.data.monto.toFixed(2)}`,
      mensaje: `${venta.clienteNombre ?? "Cliente"} · venta #${venta.id}${
        parsed.data.referencia ? ` · operación ${parsed.data.referencia}` : ""
      }`,
      meta: { ventaId: venta.id, monto: parsed.data.monto },
    });
  } else {
    await notificar({
      tipo: "VENTA",
      titulo: `Pago registrado: S/ ${parsed.data.monto.toFixed(2)}`,
      mensaje: `${venta.clienteNombre ?? "Cliente"} · venta #${venta.id}`,
      meta: { ventaId: venta.id },
    });
  }

  if (final?.estado === "PAGADO") {
    await notificar({
      tipo: "VENTA",
      titulo: `Venta #${venta.id} saldada`,
      mensaje: `Se completó el pago de S/ ${num(venta.total).toFixed(2)}`,
      meta: { ventaId: venta.id },
    });
  }

  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return { ok: true, id: venta.id };
}

export async function eliminarVenta(id: number): Promise<Resultado> {
  await exigirSesion();
  try {
    await prisma.venta.delete({ where: { id } });
  } catch {
    return { ok: false, error: "No se pudo eliminar." };
  }
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function alternarRegresado(id: number): Promise<Resultado> {
  await exigirSesion();
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return { ok: false, error: "Venta no encontrada." };
  await prisma.venta.update({
    where: { id },
    data: { regresado: !venta.regresado },
  });
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  return { ok: true };
}

export async function eliminarPago(id: number): Promise<Resultado> {
  await exigirSesion();
  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) return { ok: false, error: "Pago no encontrado." };
  await prisma.pago.delete({ where: { id } });
  if (pago.ventaId) await recalcular(pago.ventaId);
  revalidatePath("/ventas");
  revalidatePath("/pagos");
  return { ok: true };
}

/** Asigna un pago sin conciliar (Yape por correo) a una venta concreta. */
export async function asignarPago(
  _prev: Resultado,
  formData: FormData,
): Promise<Resultado> {
  await exigirSesion();

  const pagoId = Number(formData.get("pagoId"));
  const ventaId = Number(formData.get("ventaId"));
  if (!Number.isInteger(pagoId) || !Number.isInteger(ventaId) || ventaId <= 0) {
    return { ok: false, error: "Datos inválidos." };
  }

  const [pago, venta] = await Promise.all([
    prisma.pago.findUnique({ where: { id: pagoId } }),
    prisma.venta.findUnique({ where: { id: ventaId } }),
  ]);
  if (!pago) return { ok: false, error: "Pago no encontrado." };
  if (!venta) return { ok: false, error: "Venta no encontrada." };
  if (pago.estado === "CONFIRMADO") return { ok: false, error: "Ese pago ya está aplicado." };
  if (pago.ventaId) return { ok: false, error: "Ese pago ya está asignado a una venta." };

  await prisma.pago.update({
    where: { id: pagoId },
    data: {
      ventaId,
      estado: "CONFIRMADO",
      nota: pago.nota ? `${pago.nota} · Asignado manualmente` : "Asignado manualmente",
    },
  });

  const final = await recalcular(ventaId);

  await notificar({
    tipo: pago.metodo === "YAPE" ? "YAPE" : "VENTA",
    titulo: `Pago de S/ ${num(pago.monto).toFixed(2)} asignado`,
    mensaje: `Venta #${ventaId}${venta.clienteNombre ? ` · ${venta.clienteNombre}` : ""}${
      final && num(final.saldo) > 0 ? ` · saldo S/ ${num(final.saldo).toFixed(2)}` : " · saldada"
    }`,
    meta: { pagoId, ventaId },
  });

  revalidatePath("/pagos");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return { ok: true, id: pagoId };
}
