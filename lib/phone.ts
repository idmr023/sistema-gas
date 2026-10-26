/** Teléfonos: solo dígitos, conservando el '+' inicial si existe. */

export function normPhone(v: unknown): string {
  const s = String(v ?? "").trim();
  const soloDigitos = s.replace(/\D/g, "");
  return s.startsWith("+") ? `+${soloDigitos}` : soloDigitos;
}

/** Formato legible: 999 888 777 / +51 999 888 777. */
export function telefonoBonito(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const conMas = s.startsWith("+");
  const d = s.replace(/\D/g, "");
  const cuerpo = d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return conMas ? `+${cuerpo}` : cuerpo;
}
