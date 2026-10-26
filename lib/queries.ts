import "server-only";
import { prisma } from "./prisma";
import { hoyISO, diasAtrasISO, isoAFecha, fechaAISO, moverDias } from "./dates";
import { num } from "./money";

/** Totales del día de hoy. */
export async function resumenHoy() {
  const hoy = hoyISO();
  const [agg, balonesHoy, prestados, aSaldoCount] = await Promise.all([
    prisma.venta.aggregate({
      where: { fecha: isoAFecha(hoy) },
      _sum: { total: true, aCuenta: true, saldo: true, cantidad: true },
      _count: true,
    }),
    prisma.venta.findMany({
      where: { fecha: isoAFecha(hoy) },
      select: { cantidad: true, premium: true },
    }),
    prisma.venta.count({ where: { prestado: true, regresado: false } }),
    prisma.venta.count({ where: { estado: { in: ["PENDIENTE", "PARCIAL"] } } }),
  ]);

  return {
    fecha: hoy,
    totalVendido: num(agg._sum.total),
    cobrado: num(agg._sum.aCuenta),
    saldo: num(agg._sum.saldo),
    balones: num(agg._sum.cantidad),
    balonesPremium: balonesHoy.filter((v) => v.premium).reduce((a, v) => a + v.cantidad, 0),
    ventas: agg._count,
    balonesPrestados: prestados,
    ventasASaldo: aSaldoCount,
  };
}

/** Ventas de los últimos N días agrupadas por fecha. */
export async function serieDiaria(dias = 7) {
  const desde = diasAtrasISO(dias - 1);
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: isoAFecha(desde) } },
    select: { fecha: true, total: true, cantidad: true },
  });

  const mapa = new Map<string, { fecha: string; total: number; balones: number }>();
  for (let i = 0; i < dias; i++) {
    const f = moverDias(hoyISO(), -i);
    mapa.set(f, { fecha: f, total: 0, balones: 0 });
  }
  for (const v of ventas) {
    const f = fechaAISO(v.fecha);
    const fila = mapa.get(f);
    if (fila) {
      fila.total += num(v.total);
      fila.balones += v.cantidad;
    }
  }
  return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Venta del día por repartidor (hoy). */
export async function porRepartidor(hoy = hoyISO()) {
  const ventas = await prisma.venta.findMany({
    where: { fecha: isoAFecha(hoy) },
    select: { total: true, cantidad: true, repartidor: { select: { nombre: true } } },
  });
  const mapa = new Map<string, { nombre: string; total: number; balones: number }>();
  for (const v of ventas) {
    const nombre = v.repartidor?.nombre ?? "Sin asignar";
    const fila = mapa.get(nombre) ?? { nombre, total: 0, balones: 0 };
    fila.total += num(v.total);
    fila.balones += v.cantidad;
    mapa.set(nombre, fila);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** Inventario del día: por marca, con la venta calculada. */
export async function inventarioDelDia(fecha: string) {
  const marcas = await prisma.marca.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  const registros = await prisma.inventarioDiario.findMany({
    where: { fecha: isoAFecha(fecha) },
  });
  const porMarca = new Map(registros.map((r) => [r.marcaId, r]));

  return marcas.map((m) => {
    const reg = porMarca.get(m.id);
    const inicio = reg?.inicio ?? 0;
    const comprados = reg?.comprados ?? 0;
    const vacios = reg?.vacios ?? 0;
    return {
      marcaId: m.id,
      marca: m.nombre,
      inicio,
      comprados,
      vacios,
      venta: inicio + comprados - vacios,
      registrado: Boolean(reg),
      notas: reg?.notas ?? "",
    };
  });
}

/** Saldos pendientes: total por cobrar y clientes con deuda. */
export async function saldosPendientes() {
  const [agg, ventas] = await Promise.all([
    prisma.venta.aggregate({
      where: { estado: { in: ["PENDIENTE", "PARCIAL"] } },
      _sum: { saldo: true },
      _count: true,
    }),
    prisma.venta.findMany({
      where: { estado: { in: ["PENDIENTE", "PARCIAL"] } },
      select: {
        id: true,
        fecha: true,
        clienteNombre: true,
        telefono: true,
        saldo: true,
        marca: { select: { nombre: true } },
        repartidor: { select: { nombre: true } },
      },
      orderBy: { fecha: "asc" },
      take: 50,
    }),
  ]);

  return { totalSaldo: num(agg._sum.saldo), cantidad: agg._count, ventas };
}

/** Balones prestados sin devolver. */
export async function balonesPrestados() {
  const ventas = await prisma.venta.findMany({
    where: { prestado: true, regresado: false },
    select: {
      id: true,
      fecha: true,
      clienteNombre: true,
      telefono: true,
      direccion: true,
      cantidad: true,
      marca: { select: { nombre: true } },
      repartidor: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });
  return ventas;
}
