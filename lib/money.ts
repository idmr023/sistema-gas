/** Dinero: siempre se trabaja en números redondeados a 2 decimales. */

export function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function r2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** 'S/ 1,234.50' en es-PE. */
export function sol(n: number): string {
  return `S/ ${num(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 1234.5 → '1234.50' (para enviar a la BD). */
export function aDecimal(n: number): string {
  return r2(n).toFixed(2);
}

export function pct(actual: number, total: number): number {
  if (!total) return 0;
  return Math.round((actual / total) * 100);
}
