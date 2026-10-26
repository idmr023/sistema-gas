import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "./prisma";
import { notificar } from "./notify";
import { num } from "./money";
import { hoyISO, isoAFecha } from "./dates";

export type ResultadoRevision = {
  ok: boolean;
  revisados: number;
  nuevos: number;
  error?: string;
};

/** Lee la configuración actual desde la base de datos. */
async function configuracion(): Promise<Record<string, string>> {
  const filas = await prisma.config.findMany();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor ?? ""]));
}

/** 'S/ 1.234,56' | 'S/ 1234.56' → 1234.56 */
function aMonto(t: string): number {
  let s = t.replace(/[^\d.,]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export type DatosYape = {
  monto: number;
  referencia: string | null;
  pagador: string | null;
};

/** Intenta extraer los datos de un pago de Yape del texto del correo. */
export function parsearYape(texto: string): DatosYape | null {
  const plano = texto.replace(/\s+/g, " ");
  if (!/yape/i.test(plano)) return null;

  const montoMatch =
    plano.match(/S\/\s*([\d.,]+)/i) || plano.match(/(?:monto|pag[oó])\s*[: ]\s*([\d.,]+)/i);
  if (!montoMatch) return null;
  const monto = aMonto(montoMatch[1]);
  if (!monto) return null;

  const refMatch = plano.match(
    /(?:operaci[oó]n|c[oó]digo|transacci[oó]n|n[°º]?)\s*(?:n[°º])?\s*[:#-]?\s*([A-Za-z0-9-]{4,30})/i,
  );

  const pagadorMatch =
    plano.match(/(?:de|por|pagado por|enviado por|remitente)\s*:?\s+([A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,25}(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,25}){0,3})/u) ||
    plano.match(/\b([A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,25}\s+[A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,25})\b/u);

  return {
    monto,
    referencia: refMatch?.[1] ?? null,
    pagador: pagadorMatch?.[1]?.trim() ?? null,
  };
}

/** Si solo una venta abierta tiene exactamente ese saldo, la cubre. */
async function asignarAutomatico(monto: number): Promise<number | null> {
  const candidatas = await prisma.venta.findMany({
    where: { estado: { in: ["PENDIENTE", "PARCIAL"] }, saldo: monto },
    orderBy: { fecha: "desc" },
    take: 2,
    select: { id: true },
  });
  if (candidatas.length !== 1) return null;
  return candidatas[0].id;
}

/** Revisa el buzón una vez. Devuelve cuántos correos se procesaron. */
export async function revisarCorreo(): Promise<ResultadoRevision> {
  const cfg = await configuracion();

  if (cfg.imap_enabled !== "1") return { ok: false, revisados: 0, nuevos: 0, error: "Revisión desactivada." };
  if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_pass) {
    return { ok: false, revisados: 0, nuevos: 0, error: "Faltan datos del correo (host/usuario/clave)." };
  }

  const client = new ImapFlow({
    host: cfg.imap_host,
    port: Number(cfg.imap_port) || 993,
    secure: true,
    auth: { user: cfg.imap_user, pass: cfg.imap_pass },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 20000,
  });

  let revisados = 0;
  let nuevos = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(cfg.imap_folder || "INBOX");
    try {
      const pendientes: string[] = [];
      for await (const msg of client.fetch({ seen: false }, { envelope: true, uid: true })) {
        revisados++;
        const message = String(msg.envelope?.messageId ?? `uid-${msg.uid}`);
        pendientes.push(message);
      }

      for (const messageId of pendientes) {
        const yaExiste = await prisma.emailProcesado.findUnique({ where: { messageId } });
        if (yaExiste) continue;
        nuevos++;
      }

      if (nuevos === 0) return { ok: true, revisados, nuevos: 0 };

      // Descarga el contenido de los que aún no registramos.
      let vistos = 0;
      for await (const msg of client.fetch(
        { seen: false },
        { envelope: true, source: true, uid: true, flags: true },
      )) {
        const messageId = String(msg.envelope?.messageId ?? `uid-${msg.uid}`);
        if (await prisma.emailProcesado.findUnique({ where: { messageId } })) continue;

        const remitente = msg.envelope?.from?.[0]?.address ?? "";
        const asunto = msg.envelope?.subject ?? "";

        const raw = msg.source as unknown;
        const fuente: Buffer | null = Buffer.isBuffer(raw)
          ? raw
          : typeof raw === "string"
            ? Buffer.from(raw)
            : null;
        const email = fuente ? await simpleParser(fuente).catch(() => null) : null;
        const extraido = [
          email?.text ?? "",
          typeof email?.html === "string" ? email.html.replace(/<[^>]+>/g, " ") : "",
        ]
          .join(" ")
          .trim();
        const plano = `${asunto} ${extraido || (fuente ? fuente.toString("utf8") : "")}`;
        const datos = parsearYape(plano);
        const cuerpo = plano.replace(/\s+/g, " ").trim().slice(0, 1500);

        if (datos) {
          const ventaId = await asignarAutomatico(datos.monto);
          const pago = await prisma.pago.create({
            data: {
              fecha: isoAFecha(hoyISO()),
              monto: datos.monto,
              metodo: "YAPE",
              origen: "IMAP",
              estado: ventaId ? "CONFIRMADO" : "PENDIENTE",
              referencia: datos.referencia,
              pagador: datos.pagador,
              ventaId,
              nota: ventaId ? "Conciliado automáticamente" : "Pendiente de asignar a una venta",
            },
          });

          if (ventaId) {
            await recalcularVenta(ventaId);
            await notificar({
              tipo: "YAPE",
              titulo: `Yape aplicado: S/ ${datos.monto.toFixed(2)}`,
              mensaje: `Venta #${ventaId}${datos.pagador ? ` · ${datos.pagador}` : ""}${
                datos.referencia ? ` · op. ${datos.referencia}` : ""
              }`,
              meta: { pagoId: pago.id, ventaId },
            });
          } else {
            await notificar({
              tipo: "YAPE",
              titulo: `Nuevo Yape: S/ ${datos.monto.toFixed(2)}`,
              mensaje: `${datos.pagador ?? "Sin nombre"}${
                datos.referencia ? ` · op. ${datos.referencia}` : ""
              } · asignar en Pagos`,
              meta: { pagoId: pago.id },
            });
          }
        }

        await prisma.emailProcesado.create({
          data: {
            messageId,
            remitente,
            asunto,
            fechaCorreo: isoAFecha(hoyISO()),
            monto: datos?.monto ?? null,
            referencia: datos?.referencia ?? null,
            pagador: datos?.pagador ?? null,
            crudo: cuerpo,
            pagoId: null,
          },
        });
        vistos++;
        if (vistos >= 10) break; // tope por revisión
      }

      return { ok: true, revisados, nuevos: Math.min(vistos, 10) };
    } finally {
      lock.release();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, revisados, nuevos, error: `Error IMAP: ${msg}` };
  } finally {
    try {
      await client.logout();
    } catch {
      /* desconectado */
    }
  }
}

async function recalcularVenta(ventaId: number): Promise<void> {
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return;
  const suma = await prisma.pago.aggregate({
    where: { ventaId, estado: "CONFIRMADO" },
    _sum: { monto: true },
  });
  const pagado = num(suma._sum.monto);
  const total = num(venta.total);
  const saldo = Math.max(Math.round((total - pagado) * 100) / 100, 0);
  await prisma.venta.update({
    where: { id: ventaId },
    data: {
      aCuenta: pagado,
      saldo,
      estado: pagado <= 0 ? "PENDIENTE" : saldo <= 0 ? "PAGADO" : "PARCIAL",
    },
  });
}
