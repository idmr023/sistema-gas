/**
 * Diagnóstico del flujo de login por HTTP (contra el servidor en :3000).
 * Crea un usuario temporal, recorre contraseña → cambio → 2FA → re-login,
 * prueba el acceso por correo y el restablecimiento de 2FA. Limpia al final.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const USER = "diag_tmp_user";
const PASS = "DiagTmp123!";
const PASS_NUEVA = "DiagTmp456!";

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

const jar = {};
const cookieHeader = () =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
function absorber(r) {
  for (const sc of r.headers.getSetCookie?.() ?? []) {
    const par = sc.split(";")[0];
    const i = par.indexOf("=");
    const n = par.slice(0, i);
    const v = par.slice(i + 1);
    if (!v) delete jar[n];
    else jar[n] = v;
  }
}
function olvidar() {
  for (const k of Object.keys(jar)) delete jar[k];
}
async function get(ruta) {
  const r = await fetch(BASE + ruta, {
    headers: { cookie: cookieHeader(), accept: "text/html", origin: BASE },
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
    headers: { cookie: cookieHeader(), accept: "text/html", origin: BASE },
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
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (!name) continue;
    out[name] = dec(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return out;
}
const loc = (r) => r.headers.get("location") ?? "";
const errores = (html) => [...html.matchAll(/"error":"([^"]*)"/g)].map((m) => m[1]);
function ok(cond, msg) {
  console.log(cond ? `  ✓ ${msg}` : `  ✗ ${msg}`);
  if (!cond) process.exitCode = 1;
}

function descifrarSecreto(dato) {
  const clave = crypto.scryptSync(ENV.AUTH_SECRET, "sistema-gas-totp", 32);
  const [ivB, tagB, dataB] = dato.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", clave, Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dataB, "base64url")), d.final()]).toString("utf8");
}
function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(String(p), salt, 32).toString("hex")}`;
}
const { TOTP } = await import("otpauth");
const totp = (secreto) =>
  new TOTP({
    issuer: "Sistema de Gas",
    label: "x",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secreto,
  }).generate();

const { default: pg } = await import("pg");
const db = new pg.Client({
  connectionString: ENV.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await db.connect();
  await db.query(`DELETE FROM usuarios WHERE nombre = $1`, [USER]);
  const rol = await db.query(`SELECT id FROM roles WHERE nombre = 'ADMIN'`);
  await db.query(
    `INSERT INTO usuarios (nombre, email, password_hash, must_change_password, rol_id, activo, created_at, updated_at)
     VALUES ($1, $2, $3, true, $4, true, now(), now())`,
    [USER, `${USER}@sistema.local`, hashPassword(PASS), rol.rows[0].id],
  );
  console.log("usuario temporal creado\n");

  console.log("1) Login con contraseña correcta");
  let g = await get("/login");
  let res = await post("/login", { ...campos(g.html), nombre: USER, password: PASS });
  ok(
    res.r.status === 303 && loc(res.r) === "/login/cambiar" && Boolean(jar.gas_pend),
    `redirige a /login/cambiar (HTTP ${res.r.status} ${loc(res.r)})`,
  );

  console.log("2) Cambio forzado de contraseña");
  g = await get("/login/cambiar");
  res = await post("/login/cambiar", {
    ...campos(g.html),
    nueva: PASS_NUEVA,
    repetir: PASS_NUEVA,
  });
  ok(
    res.r.status === 303 && loc(res.r) === "/login/2fa/configurar",
    `nueva contraseña guardada → ${loc(res.r)}`,
  );

  console.log("3) Configurar 2FA con el código correcto");
  g = await get("/login/2fa/configurar");
  ok(res.r.status === 200 || g.r.status === 200, "pantalla de 2FA");
  let fila = await db.query(`SELECT two_factor_secret FROM usuarios WHERE nombre = $1`, [USER]);
  let secreto = descifrarSecreto(fila.rows[0].two_factor_secret);
  res = await post("/login/2fa/configurar", { ...campos(g.html), codigo: totp(secreto) });
  ok(res.r.status === 303 && loc(res.r) === "/login/2fa", `activar → ${loc(res.r)}`);

  console.log("4) Verificar 2FA");
  g = await get("/login/2fa");
  res = await post("/login/2fa", { ...campos(g.html), codigo: totp(secreto) });
  ok(
    res.r.status === 303 && loc(res.r) === "/dashboard" && Boolean(jar.gas_session),
    `sesión creada → ${loc(res.r)}`,
  );

  console.log("5) Re-login con la contraseña nueva");
  olvidar();
  g = await get("/login");
  res = await post("/login", { ...campos(g.html), nombre: USER, password: PASS_NUEVA });
  ok(
    res.r.status === 303 && loc(res.r) === "/login/2fa",
    `contraseña nueva aceptada → ${loc(res.r)}`,
  );

  console.log("6) Re-login con el CORREO en vez del nombre");
  olvidar();
  g = await get("/login");
  res = await post("/login", {
    ...campos(g.html),
    nombre: `${USER}@sistema.local`,
    password: PASS_NUEVA,
  });
  ok(
    res.r.status === 303 && Boolean(jar.gas_pend),
    `acceso por correo → ${loc(res.r) || res.r.status} ${JSON.stringify(errores(res.html))}`,
  );

  console.log("7) Restablecer 2FA (clave nueva) desde /login/2fa/configurar");
  olvidar();
  g = await get("/login");
  await post("/login", { ...campos(g.html), nombre: USER, password: PASS_NUEVA });
  g = await get("/login/2fa/configurar");
  ok(g.html.includes("Reconfigura tu 2FA"), "la pantalla pide reconfigurar");
  res = await post("/login/2fa/configurar", {
    ...campos(g.html),
    password: PASS_NUEVA,
  });
  ok(
    res.r.status === 303 && loc(res.r) === "/login/2fa/configurar",
    `clave regenerada → ${loc(res.r)}`,
  );
  fila = await db.query(
    `SELECT two_factor_secret, two_factor_enabled FROM usuarios WHERE nombre = $1`,
    [USER],
  );
  const secreto2 = descifrarSecreto(fila.rows[0].two_factor_secret);
  ok(secreto2 !== secreto, "el secreto 2FA en BD cambió");
  ok(fila.rows[0].two_factor_enabled === false, "2FA queda pendiente de activar");

  console.log("8) El código nuevo sí funciona");
  g = await get("/login/2fa/configurar");
  res = await post("/login/2fa/configurar", { ...campos(g.html), codigo: totp(secreto2) });
  ok(res.r.status === 303 && loc(res.r) === "/login/2fa", `activar → ${loc(res.r)}`);
  g = await get("/login/2fa");
  res = await post("/login/2fa", { ...campos(g.html), codigo: totp(secreto2) });
  ok(
    res.r.status === 303 && loc(res.r) === "/dashboard",
    `entra con la clave nueva → ${loc(res.r)}`,
  );

  console.log("9) Tolerancia de reloj: código del paso anterior (±30 s)");
  const codigoViejo = totp(secreto2);
  await new Promise((r) => setTimeout(r, 31000));
  olvidar();
  g = await get("/login");
  await post("/login", { ...campos(g.html), nombre: USER, password: PASS_NUEVA });
  g = await get("/login/2fa");
  res = await post("/login/2fa", { ...campos(g.html), codigo: codigoViejo });
  ok(
    res.r.status === 303 && loc(res.r) === "/dashboard",
    `código del paso anterior aceptado (HTTP ${res.r.status} ${loc(res.r)}) ${JSON.stringify(errores(res.html))}`,
  );

  console.log("10) Contraseña incorrecta sigue rechazada");
  olvidar();
  g = await get("/login");
  res = await post("/login", { ...campos(g.html), nombre: USER, password: "MALA" });
  ok(
    res.r.status === 200 && errores(res.html).length > 0 && !jar.gas_pend,
    `rechazada: ${JSON.stringify(errores(res.html))}`,
  );
} catch (e) {
  console.error("ERROR:", e);
  process.exitCode = 1;
} finally {
  try {
    await db.query(`DELETE FROM usuarios WHERE nombre = $1`, [USER]);
    console.log("\nusuario temporal eliminado");
  } catch {}
  await db.end().catch(() => {});
}
