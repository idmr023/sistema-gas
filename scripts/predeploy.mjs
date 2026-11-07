/**
 * Pre-deploy seguro para Netlify/Render:
 * - Si no hay DATABASE_URL (build sin secrets), omite las migraciones y el seed
 *   para no romper el deploy.
 * - Si hay conexión, aplica migraciones pendientes y ejecuta el seed
 *   (idempotente: solo crea lo que falta o repara hashes inválidos).
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function leerEnv(archivo) {
  const out = {};
  if (!fs.existsSync(archivo)) return out;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...leerEnv(".env"), ...leerEnv(".env.local") };
const hayDb = Boolean(env.DATABASE_URL || process.env.DATABASE_URL);

if (!hayDb) {
  console.log("[predeploy] Sin DATABASE_URL — se omiten migraciones y seed.");
  process.exit(0);
}

console.log("[predeploy] Aplicando migraciones pendientes...");
execSync("npx prisma migrate deploy", { stdio: "inherit" });

console.log("[predeploy] Ejecutando seed (idempotente)...");
execSync("npx prisma db seed", { stdio: "inherit" });

console.log("[predeploy] Listo.");
