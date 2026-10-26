'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'gas.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  precio_defecto REAL NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS repartidores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  telefono TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre TEXT,
  direccion TEXT,
  telefono TEXT,
  premium INTEGER NOT NULL DEFAULT 0,
  marca_id INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  valor_unitario REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  prestado INTEGER NOT NULL DEFAULT 0,
  regresado INTEGER NOT NULL DEFAULT 0,
  repartidor_id INTEGER REFERENCES repartidores(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
  monto REAL NOT NULL,
  metodo TEXT NOT NULL DEFAULT 'efectivo',
  referencia TEXT,
  origen TEXT NOT NULL DEFAULT 'manual',
  estado TEXT NOT NULL DEFAULT 'confirmado',
  nota TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS inventario_diario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  marca_id INTEGER NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  inicio INTEGER NOT NULL DEFAULT 0,
  comprados INTEGER NOT NULL DEFAULT 0,
  vacios INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(fecha, marca_id)
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensaje TEXT,
  meta TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_repartidor ON ventas(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_inventario_fecha ON inventario_diario(fecha);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones(leida);
`;

function getConfig(clave, def = null) {
  const row = db.prepare('SELECT valor FROM config WHERE clave = ?').get(clave);
  return row ? row.valor : def;
}

function setConfig(clave, valor) {
  db.prepare(
    `INSERT INTO config (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`
  ).run(String(clave), String(valor ?? ''));
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function seed() {
  const marcasCount = db.prepare('SELECT COUNT(*) AS n FROM marcas').get().n;
  if (!marcasCount) {
    const ins = db.prepare('INSERT INTO marcas (nombre, precio_defecto) VALUES (?, ?)');
    for (const [nombre, precio] of [
      ['Solgas', 45],
      ['Lima Gas', 45],
      ['Repsol', 48],
      ['Zeta Gas', 44],
      ['Primax', 46],
    ]) {
      ins.run(nombre, precio);
    }
  }

  const repartidoresCount = db.prepare('SELECT COUNT(*) AS n FROM repartidores').get().n;
  if (!repartidoresCount) {
    const ins = db.prepare('INSERT INTO repartidores (nombre) VALUES (?)');
    for (const nombre of ['Adolfo', 'David', 'Michael', 'Jose']) {
      ins.run(nombre);
    }
  }

  const defaults = {
    nombre_negocio: 'Distribuidora de Gas',
    telefono_negocio: '',
    direccion_negocio: '',
    yape_numero: '',
    yape_titular: '',
    yape_webhook_secret: crypto.randomBytes(18).toString('hex'),
    telegram_bot_token: '',
    telegram_chat_id: '',
    sonido_yape: '1',
  };
  if (getConfig('pin_hash') === null) defaults.pin_hash = hashPin('1234');
  if (getConfig('session_secret') === null) {
    defaults.session_secret = crypto.randomBytes(32).toString('hex');
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (getConfig(k) === null) setConfig(k, v);
  }
}

function initDb() {
  db.exec(SCHEMA);
  seed();
}

module.exports = {
  db,
  initDb,
  getConfig,
  setConfig,
  hashPin,
  verifyPin,
  DB_PATH,
};
