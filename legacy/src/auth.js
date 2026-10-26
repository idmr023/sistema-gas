'use strict';

const crypto = require('node:crypto');
const { getConfig, setConfig, verifyPin } = require('./db');

function getSecret() {
  let s = getConfig('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setConfig('session_secret', s);
  }
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function authDisabled() {
  return process.env.AUTH_DISABLED === '1';
}

function requireAuth(req, res, next) {
  if (authDisabled()) {
    req.user = { nombre: 'admin', auth_disabled: true };
    return next();
  }
  const token = parseCookies(req.headers.cookie).gas_session;
  const data = verify(token);
  if (!data) return res.status(401).json({ error: 'No autenticado' });
  req.user = data;
  next();
}

function checkPin(pin) {
  return verifyPin(pin, getConfig('pin_hash'));
}

function issueToken(nombre) {
  return sign({ nombre: nombre || 'admin', exp: Date.now() + 30 * 24 * 3600 * 1000 });
}

module.exports = {
  requireAuth,
  parseCookies,
  checkPin,
  issueToken,
  verify,
  authDisabled,
};
