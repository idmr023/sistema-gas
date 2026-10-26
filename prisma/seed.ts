import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPin } from "../lib/pin";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const MARCAS: [string, number][] = [
  ["Solgas", 45],
  ["Lima Gas", 45],
  ["Repsol", 48],
  ["Zeta Gas", 44],
  ["Primax", 46],
];

const REPARTIDORES = ["Adolfo", "David", "Michael", "Jose"];

const CONFIG_DEFAULTS: Record<string, string> = {
  nombre_negocio: "Distribuidora de Gas",
  telefono_negocio: "",
  direccion_negocio: "",
  yape_numero: "",
  yape_titular: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  sonido_yape: "1",
  imap_enabled: "0",
  imap_host: "",
  imap_port: "993",
  imap_user: "",
  imap_pass: "",
  imap_folder: "INBOX",
};

async function main() {
  for (const [nombre, precio] of MARCAS) {
    await prisma.marca.upsert({
      where: { nombre },
      update: {},
      create: { nombre, precioDefecto: precio },
    });
  }

  for (const nombre of REPARTIDORES) {
    await prisma.repartidor.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  const usuarios = await prisma.usuario.count();
  if (usuarios === 0) {
    await prisma.usuario.create({
      data: {
        nombre: "admin",
        pinHash: hashPin("1234"),
        rol: "ADMIN",
      },
    });
    console.log("Usuario admin creado (PIN: 1234) — cambiar en Configuración.");
  }

  for (const [clave, valor] of Object.entries(CONFIG_DEFAULTS)) {
    const existe = await prisma.config.findUnique({ where: { clave } });
    if (!existe) await prisma.config.create({ data: { clave, valor } });
  }

  const marcas = await prisma.marca.count();
  const reps = await prisma.repartidor.count();
  console.log(`Seed listo → ${marcas} marcas, ${reps} repartidores, ${usuarios} usuario(s) previos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
