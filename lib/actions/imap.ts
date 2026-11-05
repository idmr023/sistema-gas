"use server";

import { revalidatePath } from "next/cache";
import { exigirPermisoApi } from "@/lib/auth";
import { revisarCorreo, type ResultadoRevision } from "@/lib/imap";

/** Prueba manual del buzón desde Configuración. */
export async function revisarAhora(): Promise<ResultadoRevision> {
  await exigirPermisoApi("configuracion");
  const r = await revisarCorreo();
  revalidatePath("/pagos");
  revalidatePath("/notificaciones");
  return r;
}
