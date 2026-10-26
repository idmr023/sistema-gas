import { NextRequest } from "next/server";
import { suscribir } from "@/lib/notify";
import { exigirSesionApi } from "@/lib/auth";


export async function GET(req: NextRequest) {
  try {
    await exigirSesionApi();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const encoder = new TextEncoder();
  let cancelar: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enviar = (msg: string) => {
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {
          cancelar?.();
        }
      };
      enviar("retry: 3000\n\n");
      enviar(": conectado\n\n");
      cancelar = suscribir(enviar);
      const latido = setInterval(() => enviar(": ping\n\n"), 20000);
      req.signal.addEventListener("abort", () => {
        clearInterval(latido);
        cancelar?.();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      });
    },
    cancel() {
      cancelar?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
