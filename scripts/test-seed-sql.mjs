import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: [".env", ".env.local"], override: true });

const sql = fs.readFileSync("db/seed.sql", "utf8");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await c.connect();
try {
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("seed.sql ejecutado sin errores (idempotente OK)");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("seed.sql FALLÓ:", e.message);
  process.exitCode = 1;
}
const r = await c.query(
  "select (select count(*) from roles) as roles, (select count(*) from usuarios) as usuarios, (select count(*) from marcas) as marcas, (select count(*) from repartidores) as reps",
);
console.log("conteos:", JSON.stringify(r.rows[0]));
await c.end();
