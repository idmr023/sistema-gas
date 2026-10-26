"use client";

import { useActionState, useState } from "react";
import { registrarPago, alternarRegresado, eliminarVenta } from "@/lib/actions/ventas";
import { num, sol } from "@/lib/money";
import { fechaLarga } from "@/lib/dates";

export type VentaFila = {
  id: number;
  fecha: Date | string;
  clienteNombre: string | null;
  telefono: string | null;
  direccion: string | null;
  premium: boolean;
  cantidad: number;
  valorUnitario: unknown;
  total: unknown;
  aCuenta: unknown;
  saldo: unknown;
  estado: "PENDIENTE" | "PARCIAL" | "PAGADO";
  prestado: boolean;
  regresado: boolean;
  notas: string | null;
  marca: { nombre: string } | null;
  repartidor: { nombre: string } | null;
  pagos: { id: number; monto: unknown; metodo: string; fecha: Date | string; referencia: string | null }[];
};

function PagoForm({ venta, onListo }: { venta: VentaFila; onListo: () => void }) {
  const [estado, accion, pendiente] = useActionState(registrarPago, { ok: false });
  const saldo = num(venta.saldo);

  return (
    <form
      action={accion}
      onSubmit={() => {
        setTimeout(onListo, 100);
      }}
      className="mt-3 rounded-xl bg-slate-50 p-3"
    >
      <input type="hidden" name="ventaId" value={venta.id} />
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <label className="label" htmlFor={`monto-${venta.id}`}>
            Monto (S/)
          </label>
          <input
            id={`monto-${venta.id}`}
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            max={saldo}
            defaultValue={saldo > 0 ? saldo : ""}
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-1">
          <label className="label" htmlFor={`metodo-${venta.id}`}>
            Método
          </label>
          <select id={`metodo-${venta.id}`} name="metodo" className="input">
            <option value="EFECTIVO">Efectivo</option>
            <option value="YAPE">Yape</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="label" htmlFor={`ref-${venta.id}`}>
            Operación / ref.
          </label>
          <input id={`ref-${venta.id}`} name="referencia" className="input" placeholder="Opcional" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-1">
          <button type="submit" disabled={pendiente} className="btn btn-primary w-full">
            {pendiente ? "…" : "Cobrar"}
          </button>
        </div>
      </div>
      {estado.error && (
        <p className="mt-2 text-xs font-semibold text-red-600">{estado.error}</p>
      )}
    </form>
  );
}

export default function VentaFila({ venta }: { venta: VentaFila }) {
  const [abierta, setAbierta] = useState(false);
  const [pago, setPago] = useState(false);
  const [cargando, setCargando] = useState(false);

  const total = num(venta.total);
  const pagado = num(venta.aCuenta);
  const saldo = num(venta.saldo);
  const iso = typeof venta.fecha === "string" ? venta.fecha : venta.fecha.toISOString();

  async function toggleRegresado() {
    setCargando(true);
    await alternarRegresado(venta.id);
    setCargando(false);
    location.reload();
  }

  async function borrar() {
    if (!confirm(`¿Eliminar la venta #${venta.id}? Se borran sus pagos.`)) return;
    setCargando(true);
    const r = await eliminarVenta(venta.id);
    setCargando(false);
    if (!r.ok) alert(r.error ?? "No se pudo eliminar");
    else location.reload();
  }

  return (
    <div className="border-b border-slate-100 bg-white last:border-0">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">
            {venta.clienteNombre || "Mostrador"}
            {venta.premium && <span className="ml-1 text-xs">⭐</span>}
          </p>
          <p className="truncate text-xs text-slate-500">
            {fechaLarga(iso.slice(0, 10))} · {venta.marca?.nombre ?? "—"} ·{" "}
            {venta.cantidad} balón(es) · {venta.repartidor?.nombre ?? "Sin repartidor"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-extrabold text-slate-900">{sol(total)}</p>
          {venta.estado === "PAGADO" ? (
            <span className="badge badge-green">Pagado</span>
          ) : (
            <span className="badge badge-amber">Saldo {sol(saldo)}</span>
          )}
        </div>
      </button>

      {abierta && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            {venta.direccion && <span>📍 {venta.direccion}</span>}
            {venta.telefono && <span>📞 {venta.telefono}</span>}
            <span>Pagado: {sol(pagado)}</span>
            {venta.prestado && (
              <span className={venta.regresado ? "badge badge-green" : "badge badge-red"}>
                {venta.regresado ? "Balón regresado" : "Balón prestado"}
              </span>
            )}
            {venta.notas && <span>📝 {venta.notas}</span>}
          </div>

          {venta.pagos.length > 0 && (
            <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="card-title">Pagos</p>
              <ul className="space-y-1 text-xs">
                {venta.pagos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {fechaLarga(
                        (typeof p.fecha === "string" ? p.fecha : p.fecha.toISOString()).slice(0, 10),
                      )}{" "}
                      · {p.metodo}
                      {p.referencia ? ` · ${p.referencia}` : ""}
                    </span>
                    <span className="font-bold">{sol(num(p.monto))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {saldo > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setPago((v) => !v)}>
                💰 Registrar pago
              </button>
            )}
            {venta.prestado && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleRegresado}
                disabled={cargando}
              >
                {venta.regresado ? "↩︎ Marcar sin devolver" : "✅ Marcar devuelto"}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={borrar} disabled={cargando}>
              🗑 Eliminar
            </button>
          </div>

          {pago && <PagoForm venta={venta} onListo={() => location.reload()} />}
        </div>
      )}
    </div>
  );
}
