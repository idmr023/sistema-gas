import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionApi } from "@/lib/auth";
import { isoAFecha, hoyISO, diasAtrasISO, fechaAISO, fechaLarga } from "@/lib/dates";
import { num, aDecimal } from "@/lib/money";


function csv(filas: (string | number)[][]): string {
  const cuerpo = filas
    .map((f) =>
      f
        .map((c) => {
          const s = String(c ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\r\n");
  return `﻿${cuerpo}`;
}

export async function GET(req: NextRequest) {
  try {
    await exigirSesionApi();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const tipo = p.get("tipo") || "ventas";
  const desde = p.get("desde") || diasAtrasISO(30);
  const hasta = p.get("hasta") || hoyISO();
  const rango = {
    gte: isoAFecha(desde),
    lte: isoAFecha(hasta),
  };

  if (tipo === "pagos") {
    const pagos = await prisma.pago.findMany({
      where: { fecha: rango },
      include: { venta: { select: { clienteNombre: true } } },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    });
    const filas: (string | number)[][] = [
      ["Fecha", "Venta", "Cliente", "Método", "Origen", "Referencia", "Monto", "Nota"],
      ...pagos.map((g) => [
        fechaLarga(fechaAISO(g.fecha)),
        g.ventaId ?? "",
        g.venta?.clienteNombre ?? "",
        g.metodo,
        g.origen,
        g.referencia ?? "",
        aDecimal(num(g.monto)),
        g.nota ?? "",
      ]),
    ];
    return new Response(csv(filas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pagos_${desde}_${hasta}.csv"`,
      },
    });
  }

  const ventas = await prisma.venta.findMany({
    where: { fecha: rango },
    include: {
      marca: { select: { nombre: true } },
      repartidor: { select: { nombre: true } },
    },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });

  const filas: (string | number)[][] = [
    [
      "Fecha",
      "Cliente",
      "Teléfono",
      "Dirección",
      "Marca",
      "Premium",
      "Cantidad",
      "Valor unitario",
      "Total",
      "A cuenta",
      "Saldo",
      "Estado",
      "Prestado",
      "Regresado",
      "Repartidor",
      "Notas",
    ],
    ...ventas.map((v) => [
      fechaLarga(fechaAISO(v.fecha)),
      v.clienteNombre ?? "",
      v.telefono ?? "",
      v.direccion ?? "",
      v.marca?.nombre ?? "",
      v.premium ? "Sí" : "No",
      v.cantidad,
      aDecimal(num(v.valorUnitario)),
      aDecimal(num(v.total)),
      aDecimal(num(v.aCuenta)),
      aDecimal(num(v.saldo)),
      v.estado,
      v.prestado ? "Sí" : "No",
      v.regresado ? "Sí" : "No",
      v.repartidor?.nombre ?? "",
      (v.notas ?? "").replace(/\n/g, " "),
    ]),
  ];

  return new Response(csv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas_${desde}_${hasta}.csv"`,
    },
  });
}
