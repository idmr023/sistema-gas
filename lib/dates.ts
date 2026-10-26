/** Utilidades de fecha: las fechas se guardan como `YYYY-MM-DD` (UTC a medianoche). */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha local de hoy (según la PC del negocio). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hoy menos N días. */
export function diasAtrasISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → objeto Date (medianoche UTC) para Prisma @db.Date. */
export function isoAFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date de Prisma @db.Date → 'YYYY-MM-DD'. */
export function fechaAISO(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** 'YYYY-MM-DD' → 'lunes, 25 de octubre de 2026'. */
export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dia]}, ${d} de ${MESES[m - 1]} de ${y}`;
}

/** Suma/resta días a un ISO. */
export function moverDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}
