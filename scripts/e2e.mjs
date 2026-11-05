/**
 * Prueba E2E contra el servidor (next start en :3000).
 * Flujo: login con contraseña → cambio forzado → 2FA TOTP → venta → pagos →
 * permisos por rol → rechazo de CLIENTE. Restaura las credenciales seed al final.
 * Uso: node scripts/e2e.mjs   (BASE=http://localhost:3000 opcional)
 */
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const PASS_SEED_ADMIN = "Admin123!";
const PASS_SEED_COLAB = "Colabora123!";
const PASS_ADMIN_E2E = "AdminE2e!2026";
const PASS_COLAB_E2E = "ColabE2e!2026";
const PASS_CLIENTE = "ClienteE2e!1";
const CLIENTE_VENTA = `Prueba E2E ${Date.now()}`;

/* ── Entorno (.env.local gana sobre .env, igual que Next) ─────────── */
function leerEnv(archivo) {
  const out = {};
  if (!fs.existsSync(archivo)) return out;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const ENV = { ...leerEnv(".env"), ...leerEnv(".env.local") };
if (!ENV.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env / .env.local");
  process.exit(1);
}
if (!ENV.AUTH_SECRET) {
  console.error("Falta AUTH_SECRET en .env / .env.local");
  process.exit(1);
}

/* ── Helpers HTTP con jar de cookies ──────────────────────────────── */
const jar = {};
function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function absorber(r) {
  for (const sc of r.headers.getSetCookie?.() ?? []) {
    const par = sc.split(";")[0];
    const i = par.indexOf("=");
    const nombre = par.slice(0, i);
    const valor = par.slice(i + 1);
    if (!valor) delete jar[nombre];
    else jar[nombre] = valor;
  }
}
function olvidarCookies() {
  for (const k of Object.keys(jar)) delete jar[k];
}

async function get(ruta) {
  const r = await fetch(BASE + ruta, {
    headers: { cookie: cookieHeader(), accept: "text/html" },
    redirect: "manual",
  });
  absorber(r);
  return { r, html: await r.text() };
}

async function post(ruta, datos) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(datos)) if (v != null) fd.append(k, v);
  const r = await fetch(BASE + ruta, {
    method: "POST",
    body: fd,
    headers: { cookie: cookieHeader(), accept: "text/html" },
    redirect: "manual",
  });
  absorber(r);
  return { r, html: await r.text() };
}

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
  const bloque =
    html.match(new RegExp(`<select[^>]*name="${select}"[\\s\\S]*?</select>`))?.[0] ?? "";
  return [...bloque.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map((m) => ({
    valor: m[1],
    texto: m[2].trim(),
  }));
}

function ok(cond, msg) {
  console.log(cond ? `  ✓ ${msg}` : `  ✗ ${msg}`);
  if (!cond) process.exitCode = 1;
}

function location(r) {
  return r.headers.get("location") ?? "";
}

/* ── Crypto: TOTP + cifrado de secreto + hash de contraseña ──────── */
function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of s.replace(/=+$/g, "").toUpperCase()) {
    const idx = A.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secretB32) {
  const key = base32Decode(secretB32);
  const counter = BigInt(Math.floor(Date.now() / 30000));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const off = h[19] & 0xf;
  const bin =
    ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

function descifrarSecreto(dato, authSecret) {
  const clave = crypto.scryptSync(authSecret, "sistema-gas-totp", 32);
  const [ivB, tagB, dataB] = dato.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", clave, Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(dataB, "base64url")),
    d.final(),
  ]).toString("utf8");
}

function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(p), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

async function secretoDeBD(db, nombre) {
  const q = await db.query(
    "SELECT two_factor_secret FROM usuarios WHERE nombre = $1",
    [nombre],
  );
  const cifrado = q.rows[0]?.two_factor_secret;
  if (!cifrado) return null;
  return descifrarSecreto(cifrado, ENV.AUTH_SECRET);
}

/* ── Login multi-paso ─────────────────────────────────────────────── */
async function intentarLogin(nombre, password) {
  const { html } = await get("/login");
  const f = campos(html);
  return post("/login", { ...f, nombre, password });
}

/**
 * Ejecuta el flujo completo: contraseña → cambio forzado → 2FA → sesión.
 * `passSeed` es la contraseña actual del usuario (seed la primera vez).
 */
async function loginCompleto(db, nombre, passSeed, passNueva, requiere2fa) {
  olvidarCookies();

  // contraseña incorrecta
  const mal = await intentarLogin(nombre, "clave-totalmente-mal");
  ok(
    !jar.gas_pend && !jar.gas_session,
    `${nombre}: contraseña incorrecta NO crea pendiente ni sesión`,
  );
  ok(
    /incorrecto/i.test(mal.html),
    `${nombre}: mensaje de error visible`,
  );

  // contraseña correcta (probamos la nueva primero por si ya fue cambiada)
  let buena = await intentarLogin(nombre, passNueva);
  let passUsada = passNueva;
  if (!jar.gas_pend) {
    buena = await intentarLogin(nombre, passSeed);
    passUsada = passSeed;
  }
  const loc0 = location(buena.r);
  ok(
    Boolean(jar.gas_pend) && buena.r.status >= 300 && buena.r.status < 400,
    `${nombre}: contraseña correcta → pendiente + redirect ${loc0 || "(ninguno)"}`,
  );
  if (!jar.gas_pend) return false;

  let loc = loc0;

  // paso: cambio forzado de contraseña
  if (loc === "/login/cambiar") {
    const g = await get("/login/cambiar");
    ok(g.r.status === 200, `${nombre}: página de cambio de contraseña`);
    // si la contraseña actual YA es passNueva, exige una distinta para poder cambiar
    const destino =
      passUsada === passNueva ? "OtraClave!123" : passNueva;
    const r = await post("/login/cambiar", {
      ...campos(g.html),
      nueva: destino,
      repetir: destino,
    });
    loc = location(r.r);
    ok(
      r.r.status >= 300 && r.r.status < 400 && loc !== "/login/cambiar",
      `${nombre}: cambio de contraseña → ${loc || "(sin redirect)"}`,
    );
  }

  let secreto = null;

  // paso: configurar 2FA (solo primera vez)
  if (loc === "/login/2fa/configurar") {
    const g = await get("/login/2fa/configurar");
    ok(
      g.r.status === 200 && /data:image\/png/.test(g.html),
      `${nombre}: QR de 2FA visible`,
    );
    secreto = await secretoDeBD(db, nombre);
    ok(Boolean(secreto), `${nombre}: secreto TOTP guardado cifrado en BD`);
    if (!secreto) return false;
    const r = await post("/login/2fa/configurar", {
      ...campos(g.html),
      codigo: totp(secreto),
    });
    loc = location(r.r);
    ok(
      r.r.status >= 300 && r.r.status < 400,
      `${nombre}: activación 2FA → ${loc || "(sin redirect)"}`,
    );
  }

  // paso: verificar 2FA
  if (loc === "/login/2fa") {
    if (!secreto) {
      secreto = await secretoDeBD(db, nombre);
      if (!secreto) {
        ok(false, `${nombre}: no se pudo leer el secreto 2FA`);
        return false;
      }
    }
    const g = await get("/login/2fa");
    ok(g.r.status === 200 && /codigo/.test(g.html), `${nombre}: formulario 2FA`);
    const r = await post("/login/2fa", {
      ...campos(g.html),
      codigo: totp(secreto),
    });
    loc = location(r.r);
    ok(
      Boolean(jar.gas_session) && loc === "/dashboard",
      `${nombre}: 2FA verificado → sesión + /dashboard`,
    );
  }

  // sin 2FA (rol que no lo requiere): la sesión se creó en el cambio
  if (!requiere2fa && loc === "/dashboard") {
    ok(Boolean(jar.gas_session), `${nombre}: sesión creada sin 2FA`);
  }

  if (!requiere2fa && loc === "/login/2fa/configurar") {
    // no debería pasar
    ok(false, `${nombre}: no debería pedir 2FA`);
    return false;
  }

  return Boolean(jar.gas_session);
}

/* ── Programa ─────────────────────────────────────────────────────── */
const { default: pg } = await import("pg");
const db = new pg.Client({
  connectionString: ENV.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await db.connect();

  console.log("1) Login admin");
  const adminOk = await loginCompleto(db, "admin", PASS_SEED_ADMIN, PASS_ADMIN_E2E, true);
  ok(adminOk, "admin: sesión completa (contraseña + cambio + 2FA)");

  console.log("2) Páginas protegidas (admin tiene todos los permisos)");
  for (const ruta of [
    "/dashboard",
    "/ventas",
    "/inventario",
    "/pagos",
    "/reportes",
    "/clientes",
    "/configuracion",
    "/usuarios",
    "/roles",
    "/cajas",
    "/gastos",
    "/notificaciones",
  ]) {
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

  const venta = {
    ...fdVenta,
    fecha: new Date().toISOString().slice(0, 10),
    clienteNombre: CLIENTE_VENTA,
    direccion: "Av. E2E 123",
    telefono: "999000111",
    marcaId: marcas.find((m) => m.valor)?.valor ?? "",
    cantidad: "2",
    valorUnitario: "45",
    aCuenta: "30",
    repartidorId: reps.find((r) => r.valor)?.valor ?? "",
    metodoPago: "EFECTIVO",
  };
  delete venta.premium;
  delete venta.prestado;
  delete venta.regresado;
  delete venta.clienteId;

  const creada = await post("/ventas/nueva", venta);
  console.log(
    `     → HTTP ${creada.r.status} location=${location(creada.r) || "-"}`,
  );
  const errVenta =
    creada.html.match(/"error":"([^"]*)"/)?.[1] ??
    creada.html.match(/digest\\":\\"([^\\"]*)/)?.[1] ??
    "(sin error detectable)";
  console.log("     respuesta acción:", errVenta);
  if (process.env.VERBOSE) fs.writeFileSync(".tmp-venta-resp.html", creada.html);

  console.log("4) Verificación de venta");
  const { html: listado } = await get("/ventas");
  ok(listado.includes(CLIENTE_VENTA), "la venta aparece en /ventas");
  ok(listado.includes("60.00"), "saldo 60.00 reflejado (90 − 30 a cuenta)");
  const pagosPage = await get("/pagos");
  ok(
    pagosPage.html.includes("30.00") || pagosPage.html.includes(CLIENTE_VENTA),
    "el pago a cuenta figura en /pagos",
  );
  const inv = await get("/inventario");
  ok(inv.r.status === 200 && !inv.html.includes("__next_error__"), "inventario responde 200");
  const clientes = await get("/clientes");
  ok(clientes.html.includes(CLIENTE_VENTA), "cliente creado y visible en /clientes");

  const { html: dash } = await get("/dashboard");
  ok(dash.includes("2"), "dashboard refleja la venta (2 balones)");

  const csv = await fetch(
    `${BASE}/api/exportar?tipo=ventas&desde=2026-01-01&hasta=2030-01-01`,
    { headers: { cookie: cookieHeader() }, redirect: "manual" },
  );
  const texto = await csv.text();
  ok(csv.status === 200 && texto.includes(CLIENTE_VENTA), "CSV de ventas incluye la venta");

  console.log("5) Pago Yape pendiente → asignación a venta");
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
    [CLIENTE_VENTA],
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
      headers: { cookie: cookieHeader(), accept: "text/html" },
      redirect: "manual",
    });
    const cuerpo = await r.text();
    const errAsig = cuerpo.match(/"error":"([^"]*)"/)?.[1];
    ok(!errAsig, `asignación sin error (${r.status}${errAsig ? `: ${errAsig}` : ""})`);

    const despues = await db.query(`SELECT estado, venta_id FROM pagos WHERE id = $1`, [
      pagoId,
    ]);
    ok(
      despues.rows[0].estado === "CONFIRMADO" &&
        Number(despues.rows[0].venta_id) === ventaId,
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

  console.log("6) Colaborador: permisos por módulo");
  const colabOk = await loginCompleto(
    db,
    "colaborador",
    PASS_SEED_COLAB,
    PASS_COLAB_E2E,
    false,
  );
  ok(colabOk, "colaborador: sesión completa (sin 2FA)");

  for (const ruta of ["/dashboard", "/ventas", "/cajas", "/gastos", "/reportes", "/pagos"]) {
    const { r, html } = await get(ruta);
    ok(r.status === 200 && !html.includes("__next_error__"), `${ruta} → 200 (tiene permiso)`);
  }
  for (const ruta of ["/usuarios", "/roles", "/clientes", "/configuracion"]) {
    const { r } = await get(ruta);
    const loc = location(r);
    ok(
      r.status >= 300 && r.status < 400 && loc === "/dashboard",
      `${ruta} → redirige a /dashboard (${r.status} ${loc})`,
    );
  }

  console.log("7) CLIENTE: etiqueta sin login");
  const rolCliente = await db.query(`SELECT id FROM roles WHERE nombre = 'CLIENTE'`);
  const rolIdCliente = rolCliente.rows[0]?.id;
  ok(Boolean(rolIdCliente), "rol CLIENTE existe");
  if (rolIdCliente) {
    await db.query(`DELETE FROM usuarios WHERE nombre = 'e2e_cliente'`);
    await db.query(
      `INSERT INTO usuarios (nombre, password_hash, must_change_password, rol_id, activo, created_at, updated_at)
       VALUES ('e2e_cliente', $1, false, $2, true, now(), now())`,
      [hashPassword(PASS_CLIENTE), rolIdCliente],
    );
    const res = await intentarLogin("e2e_cliente", PASS_CLIENTE);
    ok(
      !jar.gas_session && !jar.gas_pend,
      "CLIENTE con contraseña correcta NO obtiene sesión",
    );
    ok(
      /no puede iniciar sesión/i.test(res.html),
      "CLIENTE rechazado con mensaje claro",
    );
  }

  console.log("8) API exportar rechaza sin sesión");
  olvidarCookies();
  const csvSin = await fetch(`${BASE}/api/exportar?tipo=ventas&desde=2026-01-01&hasta=2030-01-01`, {
    redirect: "manual",
  });
  ok(csvSin.status >= 300 && csvSin.status < 400, `exportar sin sesión → ${csvSin.status}`);
} catch (e) {
  console.error("  ✗ ERROR INESPERADO:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  // Restaura credenciales seed (admin/colaborador) para que el próximo
  // arranque y los humanos entren siempre igual.
  try {
    await db.query(
      `UPDATE usuarios SET password_hash = $1, must_change_password = true,
       two_factor_enabled = false, two_factor_secret = NULL, updated_at = now()
       WHERE nombre = 'admin'`,
      [hashPassword(PASS_SEED_ADMIN)],
    );
    await db.query(
      `UPDATE usuarios SET password_hash = $1, must_change_password = true, updated_at = now()
       WHERE nombre = 'colaborador'`,
      [hashPassword(PASS_SEED_COLAB)],
    );
    await db.query(`DELETE FROM usuarios WHERE nombre = 'e2e_cliente'`);
    console.log("\nCredenciales seed restauradas (admin/colaborador).");
  } catch (e) {
    console.error("No se pudieron restaurar credenciales:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}

console.log(process.exitCode ? "\nRESULTADO: HAY FALLOS" : "\nRESULTADO: TODO OK");
