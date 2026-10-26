"use client";

import { useActionState, useState } from "react";
import { guardarInventario, type ResultadoInv } from "@/lib/actions/inventario";

type Fila = {
  marcaId: number;
  marca: string;
  inicio: number;
  comprados: number;
  vacios: number;
  notas: string;
  calculado: number;
  registrado: number;
};

const inicial: ResultadoInv = { ok: false };

export default function InventarioForm({ fecha, filas }: { fecha: string; filas: Fila[] }) {
  const [estado, accion, pendiente] = useActionState(guardarInventario, inicial);
  const [datos, setDatos] = useState(
    filas.map((f) => ({
      marcaId: f.marcaId,
      inicio: f.inicio,
      comprados: f.comprados,
      vacios: f.vacios,
      notas: f.notas,
      registrado: f.registrado,
      registrada: f.calculado !== 0 || f.inicio !== 0 || f.comprados !== 0 || f.vacios !== 0,
    })),
  );

  function cambiar(i: number, campo: "inicio" | "comprados" | "vacios", valor: string) {
    setDatos((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], [campo]: Math.max(0, Number(valor) || 0) };
      return copia;
    });
  }

  const totales = datos.reduce(
    (acc, d) => ({
      inicio: acc.inicio + d.inicio,
      comprados: acc.comprados + d.comprados,
      vacios: acc.vacios + d.vacios,
      venta: acc.venta + (d.inicio + d.comprados - d.vacios),
    }),
    { inicio: 0, comprados: 0, vacios: 0, venta: 0 },
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="fecha" value={fecha} />

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          ✅ Inventario guardado ({estado.guardados} marca(s)).
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table-base min-w-[640px]">
          <thead>
            <tr>
              <th>Marca</th>
              <th className="w-24 text-center">Inicio</th>
              <th className="w-28 text-center">Comprados</th>
              <th className="w-24 text-center">Vacios</th>
              <th className="w-28 text-center">Venta del día</th>
              <th className="w-28 text-center">Registrado</th>
              <th className="w-24 text-center">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d, i) => {
              const marca = filas[i].marca;
              const venta = d.inicio + d.comprados - d.vacios;
              const dif = venta - d.registrado;
              return (
                <tr key={d.marcaId}>
                  <td className="font-bold">
                    {marca}
                    <input type="hidden" name={`inicio_${d.marcaId}`} value={d.inicio} />
                    <input type="hidden" name={`comprados_${d.marcaId}`} value={d.comprados} />
                    <input type="hidden" name={`vacios_${d.marcaId}`} value={d.vacios} />
                    <input type="hidden" name={`notas_${d.marcaId}`} value={d.notas} />
                  </td>
                  <td className="text-center">
                    <input
                      type="number"
                      min={0}
                      value={d.inicio}
                      onChange={(e) => cambiar(i, "inicio", e.target.value)}
                      className="input w-20 py-1 text-center"
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="number"
                      min={0}
                      value={d.comprados}
                      onChange={(e) => cambiar(i, "comprados", e.target.value)}
                      className="input w-20 py-1 text-center"
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="number"
                      min={0}
                      value={d.vacios}
                      onChange={(e) => cambiar(i, "vacios", e.target.value)}
                      className="input w-20 py-1 text-center"
                    />
                  </td>
                  <td className="text-center font-extrabold">{venta}</td>
                  <td className="text-center text-slate-500">{d.registrado}</td>
                  <td className="text-center">
                    {d.registrada && dif !== 0 ? (
                      <span className={dif > 0 ? "badge badge-amber" : "badge badge-red"}>
                        {dif > 0 ? "+" : ""}
                        {dif}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-extrabold">
              <td>TOTAL</td>
              <td className="text-center">{totales.inicio}</td>
              <td className="text-center">{totales.comprados}</td>
              <td className="text-center">{totales.vacios}</td>
              <td className="text-center text-brand-600">{totales.venta}</td>
              <td colSpan={2} className="text-center text-xs font-semibold text-slate-500">
                venta = inicio + comprados − vacios
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button type="submit" disabled={pendiente} className="btn btn-primary w-full py-3">
        {pendiente ? "Guardando…" : "Guardar inventario"}
      </button>
    </form>
  );
}
