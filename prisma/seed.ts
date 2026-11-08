import dotenv from "dotenv";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password";

dotenv.config({ path: [".env", ".env.local"], override: true });

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

const TODOS_PERMISOS = [
  "ventas",
  "pagos",
  "clientes",
  "inventario",
  "cajas",
  "gastos",
  "reportes",
  "configuracion",
  "usuarios",
  "roles",
] as const;

type RolSeed = {
  nombre: string;
  requiere2fa: boolean;
  puedeLogin: boolean;
  permisos: string[];
};

const ROLES: RolSeed[] = [
  {
    nombre: "ADMIN",
    requiere2fa: true,
    puedeLogin: true,
    permisos: [...TODOS_PERMISOS],
  },
  {
    nombre: "DESARROLLADOR",
    requiere2fa: true,
    puedeLogin: true,
    permisos: TODOS_PERMISOS.filter((p) => p !== "clientes"),
  },
  {
    nombre: "COLABORADOR",
    requiere2fa: false,
    puedeLogin: true,
    permisos: ["ventas", "pagos", "inventario", "gastos"],
  },
  {
    nombre: "CLIENTE",
    requiere2fa: false,
    puedeLogin: false,
    permisos: [],
  },
];

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
  for (const rol of ROLES) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: {
        requiere2fa: rol.requiere2fa,
        puedeLogin: rol.puedeLogin,
        permisos: rol.permisos,
      },
      create: {
        nombre: rol.nombre,
        requiere2fa: rol.requiere2fa,
        puedeLogin: rol.puedeLogin,
        permisos: rol.permisos,
        esSistema: true,
      },
    });
  }

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
  const admin = await prisma.rol.findUnique({ where: { nombre: "ADMIN" } });
  const colaborador = await prisma.rol.findUnique({
    where: { nombre: "COLABORADOR" },
  });
  if (!admin || !colaborador) throw new Error("Faltan roles sembrados.");

  // Crea los usuarios seed si faltan, o si su hash no es válido (p. ej. el
  // relleno md5 que deja la migración de roles → se restaura la contraseña).
  const CREDENCIALES: [string, string, string, number][] = [
    ["admin", "Admin123!", "admin@sistema.local", admin.id],
    ["colaborador", "Colabora123!", "colaborador@sistema.local", colaborador.id],
  ];
  let creados = 0;
  for (const [nombre, password, email, rolId] of CREDENCIALES) {
    const existe = await prisma.usuario.findUnique({ where: { nombre } });
    const hashValido = existe?.passwordHash.includes(":");
    if (!existe) {
      await prisma.usuario.create({
        data: {
          nombre,
          email,
          passwordHash: hashPassword(password),
          mustChangePassword: true,
          rolId,
        },
      });
      creados++;
    } else {
      if (!hashValido) {
        await prisma.usuario.update({
          where: { nombre },
          data: { passwordHash: hashPassword(password), mustChangePassword: true },
        });
        creados++;
      }
      if (!existe.email) {
        await prisma.usuario.update({ where: { nombre }, data: { email } });
      }
    }
  }
  if (creados > 0) {
    console.log(
      `Usuarios seed (${creados}): admin (Admin123!), colaborador (Colabora123!) — cambiar contraseña en el primer inicio.`,
    );
  }

  for (const [clave, valor] of Object.entries(CONFIG_DEFAULTS)) {
    const existe = await prisma.config.findUnique({ where: { clave } });
    if (!existe) await prisma.config.create({ data: { clave, valor } });
  }

  const marcas = await prisma.marca.count();
  const reps = await prisma.repartidor.count();
  const roles = await prisma.rol.count();
  console.log(
    `Seed listo → ${roles} roles, ${marcas} marcas, ${reps} repartidores, ${usuarios} usuario(s) previos.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
