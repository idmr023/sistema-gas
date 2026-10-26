"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSesion } from "@/lib/auth";

export async function marcarLeidas(): Promise<void> {
  await exigirSesion();
  await prisma.notificacion.updateMany({ where: { leida: false }, data: { leida: true } });
  revalidatePath("/notificaciones");
}
