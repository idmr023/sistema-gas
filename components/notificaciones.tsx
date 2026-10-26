"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Notif = {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  createdAt: string;
};

const ICONOS: Record<string, string> = {
  INFO: "🔔",
  VENTA: "🧾",
  YAPE: "🟣",
  ALERTA: "⚠️",
};

function sonar() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    setTimeout(() => ctx.close(), 700);
  } catch {
    /* audio no disponible */
  }
}

export default function Notificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [toast, setToast] = useState<Notif | null>(null);
  const [sonido, setSonido] = useState(true);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const leer = setTimeout(() => setSonido(localStorage.getItem("gas_sonido") !== "0"), 0);
    fetch("/api/notificaciones?limite=20")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setNoLeidas(d.noLeidas ?? 0);
      })
      .catch(() => {});
    return () => clearTimeout(leer);
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/eventos");

    es.addEventListener("notificacion", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as Notif;
        setItems((prev) => [n, ...prev].slice(0, 30));
        setNoLeidas((v) => v + 1);
        if (sonido) sonar();
        setToast(n);
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => setToast(null), 6000);
      } catch {
        /* payload inválido */
      }
    });

    return () => es.close();
  }, [sonido]);

  const marcarTodas = useCallback(async () => {
    setNoLeidas(0);
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    await fetch("/api/notificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marcar_todas: true }),
    }).catch(() => {});
  }, []);

  const alternarSonido = () => {
    const nuevo = !sonido;
    setSonido(nuevo);
    localStorage.setItem("gas_sonido", nuevo ? "1" : "0");
    if (nuevo) sonar();
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setAbierto((v) => !v);
            if (!abierto && noLeidas > 0) void marcarTodas();
          }}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg ring-1 ring-slate-200 hover:bg-slate-50"
          aria-label="Notificaciones"
        >
          🔔
          {noLeidas > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </button>

        {abierto && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
            <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <span className="text-sm font-bold">Notificaciones</span>
                <button
                  type="button"
                  onClick={alternarSonido}
                  className="btn btn-ghost btn-sm"
                >
                  {sonido ? "🔊 Sonido" : "🔇 Silencio"}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    Sin notificaciones todavía.
                  </p>
                ) : (
                  items.map((n) => (
                    <div
                      key={n.id}
                      className="border-b border-slate-50 px-4 py-2.5 last:border-0"
                    >
                      <p className="text-sm font-semibold">
                        {ICONOS[n.tipo] ?? "🔔"} {n.titulo}
                      </p>
                      {n.mensaje && (
                        <p className="text-xs text-slate-500">{n.mensaje}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/notificaciones"
                onClick={() => setAbierto(false)}
                className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-bold text-brand-600 hover:bg-slate-50"
              >
                Ver todas
              </Link>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-[60] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
          <p className="text-sm font-bold">
            {ICONOS[toast.tipo] ?? "🔔"} {toast.titulo}
          </p>
          {toast.mensaje && (
            <p className="text-xs text-slate-300">{toast.mensaje}</p>
          )}
        </div>
      )}
    </>
  );
}
