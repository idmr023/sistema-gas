/** Arranque del servidor: inicia el revisor de correo de Yape (IMAP). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalRef = globalThis as unknown as { __revisorYape?: ReturnType<typeof setInterval> };
  if (globalRef.__revisorYape) return; // evita duplicados con hot reload

  const { revisarCorreo } = await import("./lib/imap");

  const tick = async () => {
    try {
      const r = await revisarCorreo();
      if (r.ok && r.nuevos > 0) {
        console.log(`[yape] ${r.nuevos} pago(s) nuevo(s) del correo`);
      } else if (!r.ok && r.error && !/desactivada|Faltan datos/i.test(r.error)) {
        console.warn(`[yape] ${r.error}`);
      }
    } catch (e) {
      console.warn("[yape] revisión fallida:", e instanceof Error ? e.message : e);
    }
  };

  globalRef.__revisorYape = setInterval(tick, 60_000); // cada minuto
  setTimeout(tick, 5_000); // primera revisión unos segundos después de arrancar

  console.log("[yape] revisor de correo iniciado (cada 60 s)");
}
