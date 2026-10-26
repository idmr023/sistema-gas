import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";
import { num, sol } from "@/lib/money";
import { telefonoBonito } from "@/lib/phone";
import { eliminarCliente } from "@/lib/actions/clientes";
import ClienteForm from "@/components/cliente-form";
import BotonEliminar from "@/components/boton-eliminar";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = uno(sp.q);
  const editarId = Number(uno(sp.editar)) || null;

  const [clientes, grupos] = await Promise.all([
    prisma.cliente.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { telefono: { contains: q } },
              { direccion: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.venta.groupBy({
      by: ["clienteId"],
      where: { clienteId: { not: null } },
      _sum: { total: true, saldo: true },
      _count: true,
    }),
  ]);

  const info = new Map(
    grupos.map((g) => [
      g.clienteId,
      { total: num(g._sum.total), saldo: num(g._sum.saldo), ventas: g._count },
    ]),
  );

  const editar = editarId ? clientes.find((c) => c.id === editarId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Clientes</h1>
          <p className="text-sm text-slate-500">{clientes.length} registrado(s)</p>
        </div>
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, tel…"
            className="input w-48"
          />
          <button className="btn btn-ghost">Buscar</button>
        </form>
      </div>

      <section className="card">
        <h2 className="card-title">{editar ? `Editando: ${editar.nombre}` : "Nuevo cliente"}</h2>
        <ClienteForm editar={editar} />
      </section>

      <div className="card overflow-x-auto p-0">
        <table className="table-base min-w-[560px]">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th className="text-right">Comprado</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Ventas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Sin clientes registrados todavía.
                </td>
              </tr>
            )}
            {clientes.map((c) => {
              const i = info.get(c.id) ?? { total: 0, saldo: 0, ventas: 0 };
              return (
                <tr key={c.id}>
                  <td>
                    <span className="font-bold">{c.nombre}</span>
                    {c.direccion && (
                      <span className="block truncate text-xs text-slate-400">
                        📍 {c.direccion}
                      </span>
                    )}
                  </td>
                  <td className="text-slate-600">{telefonoBonito(c.telefono) || "—"}</td>
                  <td className="text-right">{sol(i.total)}</td>
                  <td className="text-right">
                    {i.saldo > 0 ? (
                      <span className="badge badge-amber">{sol(i.saldo)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="text-right">{i.ventas}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/ventas?q=${encodeURIComponent(c.nombre)}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Ver
                    </Link>
                    <Link href={`/clientes?editar=${c.id}`} className="btn btn-ghost btn-sm">
                      Editar
                    </Link>
                    <BotonEliminar
                      accion={eliminarCliente.bind(null, c.id)}
                      mensaje={`¿Eliminar el cliente "${c.nombre}"?`}
                      etiqueta="✕"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
