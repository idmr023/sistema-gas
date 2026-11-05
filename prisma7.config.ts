import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Cargar .env / .env.local con precedencia sobre el entorno heredado
dotenv.config({ path: [".env", ".env.local"], override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migraciones sobre la conexión directa (no pooled) — regla de Neon
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
