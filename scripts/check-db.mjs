import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: [".env", ".env.local"], override: true });

const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await c.connect();
const t = await c.query(
  "select tablename from pg_tables where schemaname='public' order by 1",
);
console.log("tables:", t.rows.map((x) => x.tablename).join(", "));
const m = await c
  .query("select migration_name from _prisma_migrations order by finished_at")
  .catch(() => ({ rows: [] }));
console.log(
  "migrations:",
  m.rows.map((x) => x.migration_name).join(", "),
);
for (const tabla of ["roles", "usuarios"]) {
  const cols = await c.query(
    "select column_name from information_schema.columns where table_name = $1 order by ordinal_position",
    [tabla],
  );
  console.log(`${tabla}:`, cols.rows.map((x) => x.column_name).join(","));
}
await c.end();

const cp = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cp.connect();
console.log("pooled host:", cp.host, "db:", cp.database);
for (const tabla of ["roles", "usuarios"]) {
  const cols = await cp.query(
    "select column_name from information_schema.columns where table_name = $1 order by ordinal_position",
    [tabla],
  );
  console.log(`pooled ${tabla}:`, cols.rows.map((x) => x.column_name).join(","));
}
await cp.end();
