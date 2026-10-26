import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSesionApi } from "@/lib/auth";


export async function GET(req: Request) {
  try {
    await exigirSesionApi();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limite = Math.min(Number(url.searchParams.get("limite")) || 30, 100);
  const soloNoLeidas = url.searchParams.get("no_leidas") === "1";

  const [items, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      orderBy: { createdAt: "desc" },
      take: limite,
      ...(soloNoLeidas ? { where: { leida: false } } : {}),
    }),
    prisma.notificacion.count({ where: { leida: false } }),
  ]);

  return NextResponse.json({ items, noLeidas });
}

export async function POST(req: Request) {
  try {
    await exigirSesionApi();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.marcar_todas) {
    await prisma.notificacion.updateMany({
      where: { leida: false },
      data: { leida: true },
    });
    return NextResponse.json({ ok: true });
  }
  if (body.id) {
    await prisma.notificacion.update({
      where: { id: Number(body.id) },
      data: { leida: true },
    });
  }
  return NextResponse.json({ ok: true });
}
