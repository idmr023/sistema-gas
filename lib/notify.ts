import "server-only";
import { prisma } from "./prisma";

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function suscribir(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function broadcast(evento: string, data: unknown): void {
  const msg = `event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const fn of [...listeners]) {
    try {
      fn(msg);
    } catch {
      listeners.delete(fn);
    }
  }
}

async function enviarTelegram(notificacion: {
  tipo: string;
  titulo: string;
  mensaje: string | null;
}): Promise<void> {
  const token = await getCfg("telegram_bot_token");
  const chat = await getCfg("telegram_chat_id");
  if (!token || !chat) return;
  const icono =
    notificacion.tipo === "YAPE" ? "🟣" : notificacion.tipo === "VENTA" ? "🧾" : "🔔";
  const texto = `${icono} ${notificacion.titulo}${
    notificacion.mensaje ? `\n${notificacion.mensaje}` : ""
  }`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* sin conexión: no interrumpe */
  }
}

async function getCfg(clave: string): Promise<string> {
  const row = await prisma.config.findUnique({ where: { clave } });
  return row?.valor ?? "";
}

/** Crea una notificación, la guarda, la emite por SSE y (opcional) a Telegram. */
export async function notificar({
  tipo = "INFO",
  titulo,
  mensaje = "",
  meta = null,
}: {
  tipo?: "INFO" | "VENTA" | "YAPE" | "ALERTA";
  titulo: string;
  mensaje?: string;
  meta?: unknown;
}) {
  const row = await prisma.notificacion.create({
    data: {
      tipo,
      titulo,
      mensaje: mensaje || null,
      meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
    },
  });
  broadcast("notificacion", row);
  if ((await getCfg("telegram_bot_token")) && (await getCfg("telegram_chat_id"))) {
    void enviarTelegram({ tipo, titulo, mensaje });
  }
  return row;
}
