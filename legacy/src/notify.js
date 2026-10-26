'use strict';

const { db, getConfig } = require('./db');

const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(msg);
    } catch {
      clients.delete(res);
    }
  }
}

function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  res.write(': conectado\n\n');
  clients.add(res);

  const hb = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(hb);
    clients.delete(res);
  });
}

function crearNotificacion({ tipo = 'info', titulo, mensaje = '', meta = null } = {}) {
  const info = db
    .prepare('INSERT INTO notificaciones (tipo, titulo, mensaje, meta) VALUES (?, ?, ?, ?)')
    .run(tipo, String(titulo), String(mensaje), meta ? JSON.stringify(meta) : null);
  const row = db
    .prepare('SELECT * FROM notificaciones WHERE id = ?')
    .get(Number(info.lastInsertRowid));
  broadcast('notificacion', row);
  sendTelegram(row).catch(() => {});
  return row;
}

async function sendTelegram(row) {
  const token = getConfig('telegram_bot_token');
  const chat = getConfig('telegram_chat_id');
  if (!token || !chat) return;
  const icon = row.tipo === 'yape' ? '🟣' : row.tipo === 'venta' ? '🧾' : '🔔';
  const text = `${icon} ${row.titulo}${row.mensaje ? `\n${row.mensaje}` : ''}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
}

module.exports = { crearNotificacion, sseHandler, broadcast };
