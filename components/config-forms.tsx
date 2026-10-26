"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  guardarConfig,
  cambiarPin,
  guardarMarca,
  guardarRepartidor,
  type ResultadoCfg,
} from "@/lib/actions/config";

const inicial: ResultadoCfg = { ok: false };

function useGuardado() {
  const [estado, accion, pendiente] = useActionState(guardarConfig, inicial);
  return { estado, accion, pendiente };
}

function Aviso({ estado }: { estado: ResultadoCfg }) {
  if (!estado.ok && !estado.error) return null;
  if (estado.error)
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
        {estado.error}
      </p>
    );
  return (
    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
      ✅ Guardado.
    </p>
  );
}

/* ── Datos del negocio ─────────────────────────────── */

export function NegocioForm({ cfg }: { cfg: Record<string, string> }) {
  const { estado, accion, pendiente } = useGuardado();
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="grupo" value="negocio" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nombre_negocio">Nombre del negocio</label>
          <input id="nombre_negocio" name="nombre_negocio" className="input" defaultValue={cfg.nombre_negocio ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="telefono_negocio">Teléfono</label>
          <input id="telefono_negocio" name="telefono_negocio" className="input" defaultValue={cfg.telefono_negocio ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="direccion_negocio">Dirección</label>
          <input id="direccion_negocio" name="direccion_negocio" className="input" defaultValue={cfg.direccion_negocio ?? ""} />
        </div>
      </div>
      <Aviso estado={estado} />
      <button className="btn btn-primary" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/* ── Pagos / avisos ────────────────────────────────── */

export function NotificacionesForm({ cfg }: { cfg: Record<string, string> }) {
  const { estado, accion, pendiente } = useGuardado();
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="grupo" value="notificaciones" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="yape_numero">Número de Yape</label>
          <input id="yape_numero" name="yape_numero" className="input" defaultValue={cfg.yape_numero ?? ""} placeholder="999 888 777" />
        </div>
        <div>
          <label className="label" htmlFor="yape_titular">Titular de Yape</label>
          <input id="yape_titular" name="yape_titular" className="input" defaultValue={cfg.yape_titular ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="telegram_bot_token">Token del bot de Telegram</label>
          <input id="telegram_bot_token" name="telegram_bot_token" className="input" defaultValue={cfg.telegram_bot_token ?? ""} placeholder="123456:ABC…" />
        </div>
        <div>
          <label className="label" htmlFor="telegram_chat_id">Chat ID de Telegram</label>
          <input id="telegram_chat_id" name="telegram_chat_id" className="input" defaultValue={cfg.telegram_chat_id ?? ""} placeholder="-100…" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="sonido_yape"
          value="1"
          defaultChecked={cfg.sonido_yape !== "0"}
          className="h-4 w-4 accent-amber-500"
        />
        🔊 Sonido al recibir un pago
      </label>
      <Aviso estado={estado} />
      <button className="btn btn-primary" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/* ── Correo IMAP (Yape) ────────────────────────────── */

export function ImapForm({ cfg }: { cfg: Record<string, string> }) {
  const { estado, accion, pendiente } = useGuardado();
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="grupo" value="imap" />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="imap_enabled"
          value="1"
          defaultChecked={cfg.imap_enabled === "1"}
          className="h-4 w-4 accent-amber-500"
        />
        Activar revisión automática del correo
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="imap_host">Servidor (IMAP)</label>
          <input id="imap_host" name="imap_host" className="input" defaultValue={cfg.imap_host ?? ""} placeholder="imap.gmail.com" />
        </div>
        <div>
          <label className="label" htmlFor="imap_port">Puerto</label>
          <input id="imap_port" name="imap_port" className="input" defaultValue={cfg.imap_port ?? "993"} />
        </div>
        <div>
          <label className="label" htmlFor="imap_user">Correo</label>
          <input id="imap_user" name="imap_user" className="input" defaultValue={cfg.imap_user ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="imap_pass">Contraseña / app</label>
          <input id="imap_pass" name="imap_pass" type="password" className="input" defaultValue={cfg.imap_pass ?? ""} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="imap_folder">Carpeta</label>
          <input id="imap_folder" name="imap_folder" className="input" defaultValue={cfg.imap_folder ?? "INBOX"} />
        </div>
      </div>
      <Aviso estado={estado} />
      <button className="btn btn-primary" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/* ── PIN ───────────────────────────────────────────── */

export function PinForm() {
  const [estado, accion, pendiente] = useActionState(cambiarPin, inicial);
  const ref = useRef<HTMLFormElement>(null);
  const listo = estado.ok;

  useEffect(() => {
    if (listo) ref.current?.reset();
  }, [listo]);

  return (
    <form ref={ref} action={accion} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="actual">PIN actual</label>
          <input id="actual" name="actual" type="password" inputMode="numeric" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="nuevo">PIN nuevo</label>
          <input id="nuevo" name="nuevo" type="password" inputMode="numeric" maxLength={8} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="repetir">Repetir</label>
          <input id="repetir" name="repetir" type="password" inputMode="numeric" maxLength={8} className="input" required />
        </div>
      </div>
      <Aviso estado={estado} />
      <button className="btn btn-primary" disabled={pendiente}>
        {pendiente ? "Cambiando…" : "Cambiar PIN"}
      </button>
    </form>
  );
}

/* ── Marcas ────────────────────────────────────────── */

type Marca = { id: number; nombre: string; precioDefecto: unknown; activo: boolean };

export function MarcasSection({ marcas }: { marcas: Marca[] }) {
  const [estado, accion, pendiente] = useActionState(guardarMarca, inicial);
  const [editando, setEditando] = useState<Marca | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {marcas.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <div>
              <span className={`font-bold ${m.activo ? "" : "text-slate-400 line-through"}`}>
                {m.nombre}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                S/ {Number(m.precioDefecto).toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(m)}>
                Editar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form action={accion} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
        <input type="hidden" name="id" defaultValue={editando?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="label" htmlFor="marca_nombre">Marca</label>
            <input id="marca_nombre" name="nombre" className="input" required defaultValue={editando?.nombre ?? ""} placeholder="Solgas" />
          </div>
          <div>
            <label className="label" htmlFor="marca_precio">Precio (S/)</label>
            <input id="marca_precio" name="precioDefecto" type="number" step="0.01" min="0" className="input" defaultValue={editando ? Number(editando.precioDefecto) : ""} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
              <input type="checkbox" name="activo" value="1" defaultChecked={editando ? editando.activo : true} className="h-4 w-4 accent-amber-500" />
              Activa
            </label>
          </div>
        </div>
        <Aviso estado={estado} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={pendiente}>
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "+ Agregar marca"}
          </button>
          {editando && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ── Repartidores ──────────────────────────────────── */

type Rep = { id: number; nombre: string; telefono: string | null; activo: boolean };

export function RepartidoresSection({ reps }: { reps: Rep[] }) {
  const [estado, accion, pendiente] = useActionState(guardarRepartidor, inicial);
  const [editando, setEditando] = useState<Rep | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {reps.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <div>
              <span className={`font-bold ${r.activo ? "" : "text-slate-400 line-through"}`}>
                {r.nombre}
              </span>
              {r.telefono && <span className="ml-2 text-xs text-slate-500">{r.telefono}</span>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(r)}>
              Editar
            </button>
          </li>
        ))}
      </ul>

      <form action={accion} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
        <input type="hidden" name="id" defaultValue={editando?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="rep_nombre">Nombre</label>
            <input id="rep_nombre" name="nombre" className="input" required defaultValue={editando?.nombre ?? ""} placeholder="Adolfo" />
          </div>
          <div>
            <label className="label" htmlFor="rep_tel">Teléfono</label>
            <input id="rep_tel" name="telefono" className="input" defaultValue={editando?.telefono ?? ""} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
              <input type="checkbox" name="activo" value="1" defaultChecked={editando ? editando.activo : true} className="h-4 w-4 accent-amber-500" />
              Activo
            </label>
          </div>
        </div>
        <Aviso estado={estado} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={pendiente}>
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "+ Agregar repartidor"}
          </button>
          {editando && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
