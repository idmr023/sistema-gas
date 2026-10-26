"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/pin";
import { crearSesion } from "@/lib/session";

export type EstadoLogin = { error?: string };

export async function _login(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) return { error: "Ingresa el PIN." };

  const usuario = await prisma.usuario.findFirst({
    where: { activo: true },
    orderBy: { id: "asc" },
  });

  if (!usuario || !verifyPin(pin, usuario.pinHash)) {
    return { error: "PIN incorrecto. Intenta de nuevo." };
  }

  await crearSesion(usuario.nombre, usuario.rol);
  redirect("/dashboard");
}

export async function _logout(): Promise<void> {
  const { destruirSesion } = await import("@/lib/session");
  await destruirSesion();
  redirect("/login");
}
