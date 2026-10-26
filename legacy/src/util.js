'use strict';

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localDateTime(d = new Date()) {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
}

function r2(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function toNum(v, def = 0) {
  if (v === '' || v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toBool(v) {
  return (
    v === true ||
    v === 1 ||
    v === '1' ||
    v === 'true' ||
    v === 'on' ||
    v === 'si' ||
    v === 'sí'
  )
    ? 1
    : 0;
}

function normPhone(v) {
  return String(v || '').replace(/\D/g, '');
}

module.exports = {
  pad,
  localDate,
  localDateTime,
  daysAgoISO,
  r2,
  toInt,
  toNum,
  toBool,
  normPhone,
};
