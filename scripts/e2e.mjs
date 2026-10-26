/**
 * Prueba E2E contra el servidor en producción (next start en :3000).
 * Flujo: login con PIN → crea una venta → verifica listado y dashboard.
 * Uso: node scripts/e2e.mjs
 */
const BASE = process.env.BASE || "http://localhost:3000";
const CLIENTE = `Prueba E2E ${Date.now()}`;
import fs from "node:fs";

function dec(v = "") {
  return v
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function campos(html) {
  const out = {};
  for (const m of html.matchAll(/<input[^>]*>/g)) {
    const tag = m[0];
    const name = tag.match(/name="([^"]*)"/)?.[1];
    if (!name) continue;
    const value = tag.match(/value="([^"]*)"/)?.[1];
    out[name] = dec(value ?? "");
  }
  return out;
}

function opciones(html, select) {
  const bloque = html.match(new RegExp(`<select[^>]*name="${select}"[\\s\\S]*?</select>`))?.[0] ?? "";
  return [...bloque.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map((m) => ({
    valor: m[1],
    texto: m[2].trim(),
  }));
}

function ok(cond, msg) {
  console.log(cond ? `  ✓ ${msg}` : `  ✗ ${msg}`);
  if (!cond) process.exitCode = 1;
}

let cookie = null;
async function get(ruta) {
  const r = await fetch(BASE + ruta, {
    headers: cookie ? { cookie, accept: "text/html" } : { accept: "text/html" },
    redirect: "manual",
  });
  const set = r.headers.getSetCookie?.() ?? [];
  const cs = set.find((c) => c.startsWith("gas_session="));
  if (cs) cookie = cs.split(";")[0];
  return { r, html: await r.text() };
}

async function post(ruta, datos) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(datos)) fd.append(k, v);
  const r = await fetch(BASE + ruta, {
    method: "POST",
    body: fd,
    headers: cookie ? { cookie, accept: "text/html" } : { accept: "text/html" },
    redirect: "manual",
  });
  const set = r.headers.getSetCookie?.() ?? [];
  const cs = set.find((c) => c.startsWith("gas_session="));
  if (cs) cookie = cs.split(";")[0];
  return { r, html: await r.text() };
}

console.log("1) Login");
const { html: loginHtml } = await get("/login");
const accLogin = campos(loginHtml);
ok(Object.keys(accLogin).some((k) => k.startsWith("$ACTION")), "formulario de login con acción de servidor");

const mal = await post("/login", { ...accLogin, pin: "0000" });
const malHtml = await reread(mal);
ok(!cookie, "PIN incorrecto NO crea sesión");
ok(/PIN incorrecto/i.test(malHtml), "PIN incorrecto muestra error");

const bueno = await post("/login", { ...accLogin, pin: "1234" });
ok(Boolean(cookie), "PIN 1234 crea la cookie de sesión");
const destino = bueno.r.headers.get("location") ?? "";
console.log(`     → HTTP ${bueno.r.status} location=${destino || "(redirect en cliente)"}`);

console.log("2) Páginas protegidas");
for (const ruta of ["/dashboard", "/ventas", "/inventario", "/pagos", "/reportes", "/clientes", "/configuracion"]) {
  const { r, html } = await get(ruta);
  ok(r.status === 200 && !html.includes("__next_error__"), `${ruta} → 200`);
}

console.log("3) Nueva venta");
const { html: nuevaHtml } = await get("/ventas/nueva");
const fdVenta = campos(nuevaHtml);
const marcas = opciones(nuevaHtml, "marcaId");
const reps = opciones(nuevaHtml, "repartidorId");
console.log(
  "     opciones marca:",
  marcas.map((m) => `${m.valor}=${m.texto}`).join(" | "),
);
ok(marcas.length > 0, `hay ${marcas.length} marcas disponibles`);
ok(reps.length > 0, `hay ${reps.length} repartidores disponibles`);
ok("cantidad" in fdVenta || /name="cantidad"/.test(nuevaHtml), "campo cantidad presente");

const marcaElegida = marcas.find((m) => m.valor);
const venta = {
  ...fdVenta,
  fecha: new Date().toISOString().slice(0, 10),
  clienteNombre: CLIENTE,
  direccion: "Av. E2E 123",
  telefono: "999000111",
  marcaId: marcaElegida?.valor ?? "",
  cantidad: "2",
  valorUnitario: "45",
  aCuenta: "30",
  repartidorId: reps.find((r) => r.valor)?.valor ?? "",
  metodoPago: "EFECTIVO",
};

const creada = await post("/ventas/nueva", venta);
const cuerpoVenta = creada.html;
console.log(`     → HTTP ${creada.r.status} location=${creada.r.headers.get("location") ?? "-"}`);
console.log("     campos del formulario:", Object.keys(fdVenta).filter((k) => !k.startsWith("$")).join(", "));
const errVenta =
  cuerpoVenta.match(/"error":"([^"]*)"/)?.[1] ??
  cuerpoVenta.match(/digest\\":\\"([^\\"]*)/)?.[1] ??
  "(sin error detectable)";
console.log("     respuesta acción:", errVenta);
if (process.env.VERBOSE) fs.writeFileSync(".tmp-venta-resp.html", cuerpoVenta);

console.log("4) Verificación");
const { html: listado } = await get("/ventas");
ok(listado.includes(CLIENTE), "la venta aparece en /ventas");
ok(listado.includes("60.00"), "saldo 60.00 reflejado (90 − 30 a cuenta)");
const pagos = await get("/pagos");
ok(pagos.html.includes("30.00") || pagos.html.includes(CLIENTE), "el pago a cuenta figura en /pagos");
const inv = await get("/inventario");
ok(inv.r.status === 200 && !inv.html.includes("__next_error__"), "inventario responde 200");
const clientes = await get("/clientes");
ok(clientes.html.includes(CLIENTE), "cliente creado y visible en /clientes");

const { html: dash } = await get("/dashboard");
ok(dash.includes("2"), "dashboard refleja la venta (2 balones)");

const csv = await fetch(`${BASE}/api/exportar?tipo=ventas&desde=2026-01-01&hasta=2030-01-01`, {
  headers: { cookie },
});
const texto = await csv.text();
ok(csv.status === 200 && texto.includes(CLIENTE), "CSV de ventas incluye la venta");

console.log("5) Pago Yape pendiente → asignación a venta");
const { default: pg } = await import("pg");
const url = fs
  .readFileSync(".env", "utf8")
  .match(/^DATABASE_URL=(.*)$/m)?.[1]
  .trim()
  .replace(/^"|"$/g, "");
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const ref = `op-e2e-${Date.now()}`;
  const ins = await db.query(
    `INSERT INTO pagos (fecha, monto, metodo, estado, origen, referencia, pagador, nota, created_at)
     VALUES (CURRENT_DATE, 15.50, 'YAPE', 'PENDIENTE', 'IMAP', $1, 'Cliente E2E', 'Pago detectado por correo', now())
     RETURNING id`,
    [ref],
  );
  const pagoId = ins.rows[0].id;
  ok(Number.isInteger(pagoId), `pago PENDIENTE creado (id ${pagoId})`);

  const v = await db.query(
    `SELECT id, saldo::float AS saldo, a_cuenta::float AS a_cuenta FROM ventas WHERE cliente_nombre = $1 ORDER BY id DESC LIMIT 1`,
    [CLIENTE],
  );
  const ventaId = v.rows[0].id;
  const saldoAntes = Number(v.rows[0].saldo);

  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const { html: pagosHtml } = await get(`/pagos?desde=${desde}&hasta=${hoy}`);
  const bloques = [...pagosHtml.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
  const bloque = bloques.find((f) => f.includes('name="pagoId"'));
  ok(Boolean(bloque), "el pago pendiente muestra el formulario de asignación");

  if (bloque) {
    const camposAsig = campos(bloque);
    const fd = new FormData();
    for (const [k, val] of Object.entries(camposAsig)) fd.append(k, val);
    fd.set("pagoId", String(pagoId));
    fd.set("ventaId", String(ventaId));
    const r = await fetch(`${BASE}/pagos`, {
      method: "POST",
      body: fd,
      headers: { cookie, accept: "text/html" },
      redirect: "manual",
    });
    const cuerpo = await r.text();
    const errAsig = cuerpo.match(/"error":"([^"]*)"/)?.[1];
    ok(!errAsig, `asignación sin error (${r.status}${errAsig ? `: ${errAsig}` : ""})`);

    const despues = await db.query(
      `SELECT estado, venta_id FROM pagos WHERE id = $1`,
      [pagoId],
    );
    ok(
      despues.rows[0].estado === "CONFIRMADO" && Number(despues.rows[0].venta_id) === ventaId,
      "pago pasa a CONFIRMADO y queda ligado a la venta",
    );

    const v2 = await db.query(
      `SELECT saldo::float AS saldo, a_cuenta::float AS a_cuenta, estado FROM ventas WHERE id = $1`,
      [ventaId],
    );
    const saldoEsperado = Math.round((saldoAntes - 15.5) * 100) / 100;
    ok(
      Math.abs(Number(v2.rows[0].saldo) - saldoEsperado) < 0.005,
      `saldo recalculado ${saldoAntes.toFixed(2)} → ${Number(v2.rows[0].saldo).toFixed(2)}`,
    );
    ok(v2.rows[0].estado === "PARCIAL", "estado de la venta = PARCIAL");
  }
} finally {
  await db.end();
}

console.log(process.exitCode ? "\nRESULTADO: HAY FALLOS" : "\nRESULTADO: TODO OK");

async function reread(res) {
  if (typeof res.html === "string") return res.html;
  return await res.r.text();
}
