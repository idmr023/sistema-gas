import crypto from "node:crypto";

/**
 * Contraseña segura con scrypt + salt aleatorio.
 * Formato guardado: "salt:hash" (hex)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored || typeof stored !== "string") return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const test = crypto.scryptSync(String(password), salt, 32).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(test, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Valida longitud mínima de contraseña nueva (8+). */
export function passwordValida(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}
