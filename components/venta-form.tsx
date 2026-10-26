"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { crearVenta, type Resultado } from "@/lib/actions/ventas";
import { num, sol } from "@/lib/money";

type Marca = { id: number; nombre: string; precioDefecto: unknown };
type Repartidor = { id: number; nombre: string };
type Cliente = { id: number; nombre: string; direccion: string | null; telefono: string | null };

const inicial: Resultado = { ok: false };

export default function VentaForm({
  marcas,
  repartidores,
  clientes,
  fecha,
}: {
  marcas: Marca[];
  repartidores: Repartidor[];
  clientes: Cliente[];
  fecha: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearVenta, inicial);
  const [marcaId, setMarcaId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [valor, setValor] = useState("");
  const [aCuenta, setACuenta] = useState("");
  const [tel, setTel] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const exito = Boolean(estado.ok && estado.id);

  const total = useMemo(() => r2num(cantidad * num(valor)), [cantidad, valor]);
  const saldo = useMemo(
    () => Math.max(r2num(total - num(aCuenta)), 0),
    [total, aCuenta],
  );

  function alElegirMarca(id: string) {
    setMarcaId(id);
    const m = marcas.find((x) => String(x.id) === id);
    if (m) setValor(String(num(m.precioDefecto)));
  }

  function alCambiarTelefono(v: string) {
    setTel(v);
    const digitos = v.replace(/\D/g, "");
    const encontrado = clientes.find(
      (c) => c.telefono && c.telefono.replace(/\D/g, "").includes(digitos) && digitos.length >= 7,
    );
    if (encontrado) {
      const nombre = document.getElementById("clienteNombre") as HTMLInputElement | null;
      const direccion = document.getElementById("direccion") as HTMLInputElement | null;
      const oculto = document.getElementById("clienteId") as HTMLInputElement | null;
      if (nombre) nombre.value = encontrado.nombre;
      if (direccion && !direccion.value) direccion.value = encontrado.direccion ?? "";
      if (oculto) oculto.value = String(encontrado.id);
    }
  }

  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="clienteId" id="clienteId" />

      {estado.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {estado.error}
        </p>
      )}
      {exito && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <span>✅ Venta registrada.</span>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200"
            onClick={() => window.location.reload()}
          >
            ➕ Nueva venta en blanco
          </button>
        </div>
      )}

      {/* Cliente */}
      <section className="card">
        <h3 className="card-title">Cliente y entrega</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="label" htmlFor="telefono">
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              className="input"
              placeholder="999 888 777"
              inputMode="tel"
              list="lista-clientes"
              value={tel}
              onChange={(e) => alCambiarTelefono(e.target.value)}
            />
            <datalist id="lista-clientes">
              {clientes.map((c) => (
                <option key={c.id} value={c.telefono ?? ""}>
                  {c.nombre}
                </option>
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-1">
            <label className="label" htmlFor="clienteNombre">
              Nombre
            </label>
            <input
              id="clienteNombre"
              name="clienteNombre"
              className="input"
              placeholder="Cliente de mostrador"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="direccion">
              Dirección
            </label>
            <input id="direccion" name="direccion" className="input" placeholder="Av. …" />
          </div>
        </div>
      </section>

      {/* Venta */}
      <section className="card">
        <h3 className="card-title">Balón de gas</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="marcaId">
              Marca
            </label>
            <select
              id="marcaId"
              name="marcaId"
              className="input"
              value={marcaId}
              onChange={(e) => alElegirMarca(e.target.value)}
            >
              <option value="">— Elegir —</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cantidad">
              Cantidad
            </label>
            <input
              id="cantidad"
              name="cantidad"
              type="number"
              min={1}
              className="input"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="label" htmlFor="valorUnitario">
              Valor unitario (S/)
            </label>
            <input
              id="valorUnitario"
              name="valorUnitario"
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="45.00"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="premium" className="h-4 w-4 accent-amber-500" />
            ⭐ Premium
          </label>
          <div>
            <label className="label" htmlFor="repartidorId" >
              Quién lo lleva
            </label>
            <select id="repartidorId" name="repartidorId" className="input py-1.5">
              <option value="">— Elegir —</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              name="prestado"
              className="h-4 w-4 accent-amber-500"
            />
            Balón prestado
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              name="regresado"
              className="h-4 w-4 accent-amber-500"
            />
            Balón regresado
          </label>
          <div>
            <label className="label" htmlFor="metodoPago">
              Método de pago
            </label>
            <select id="metodoPago" name="metodoPago" className="input py-1.5">
              <option value="EFECTIVO">Efectivo</option>
              <option value="YAPE">Yape</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
        </div>
      </section>

      {/* Dinero */}
      <section className="card">
        <h3 className="card-title">Cuenta</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="aCuenta">
              A cuenta (S/)
            </label>
            <input
              id="aCuenta"
              name="aCuenta"
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={aCuenta}
              onChange={(e) => setACuenta(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <span className="label">Total</span>
            <p className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-extrabold text-white">
              {sol(total)}
            </p>
          </div>
          <div>
            <span className="label">A saldo</span>
            <p
              className={`rounded-xl px-3.5 py-2.5 text-sm font-extrabold ${
                saldo > 0 ? "bg-brand-100 text-brand-800" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {sol(saldo)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="notas">
            Notas
          </label>
          <input
            id="notas"
            name="notas"
            className="input"
            placeholder="Referencia, interno, etc."
          />
        </div>
      </section>

      <button type="submit" disabled={pendiente} className="btn btn-primary w-full py-3">
        {pendiente ? "Guardando…" : "Registrar venta"}
      </button>
    </form>
  );
}

function r2num(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
