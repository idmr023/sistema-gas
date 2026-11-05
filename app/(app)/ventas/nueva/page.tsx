import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/auth";
import { hoyISO, fechaLegible } from "@/lib/dates";
import VentaForm from "@/components/venta-form";

export const metadata = { title: "Nueva venta" };

export default function NuevaVentaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaVentaPageContent />
    </Suspense>
  );
}

async function NuevaVentaPageContent() {
  await exigirPermiso("ventas");

  const [marcas, repartidores, clientes] = await Promise.all([
    prisma.marca.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.repartidor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Nueva venta</h1>
          <p className="text-sm capitalize text-slate-500">{fechaLegible(hoyISO())}</p>
        </div>
        <Link href="/ventas" className="btn btn-ghost">
          ← Volver
        </Link>
      </div>

      <VentaForm
        marcas={marcas.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          precioDefecto: Number(m.precioDefecto),
        }))}
        repartidores={repartidores}
        clientes={clientes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          direccion: c.direccion ?? "",
          telefono: c.telefono ?? "",
        }))}
        fecha={hoyISO()}
      />
    </div>
  );
}
