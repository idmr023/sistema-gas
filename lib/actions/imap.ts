"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { revisarCorreo, type ResultadoRevision } from "@/lib/imap";

/** Prueba manual del buzón desde Configuración. */
export async function revisarAhora(): Promise<ResultadoRevision> {
  await exigirSesion();
  const r = await revisarCorreo();
  revalidatePath("/pagos");
  revalidatePath("/notificaciones");
  return r;
}
