import crypto from "node:crypto";

/**
 * Contraseña segura con scrypt + salt aleatorio.
 * Formato guardado: "salt:hash" (hex)
 */

/**
 * Normaliza a NFC (Unicode) para que "ñ" escrita desde el celular (NFD)
 * y desde la PC (NFC) generen el mismo hash.
 */
function normalizar(password: string): string {
  try {
    return String(password).normalize("NFC");
  } catch {
    return String(password);
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalizar(password), salt, 32).toString("hex");
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
    const esperado = Buffer.from(hash, "hex");
    // Se prueban la forma normalizada (NFC) y la original: los hashes creados
    // antes de la normalización deben seguir funcionando.
    for (const clave of new Set([normalizar(password), String(password)])) {
      const test = crypto.scryptSync(clave, salt, 32).toString("hex");
      const b = Buffer.from(test, "hex");
      if (b.length !== esperado.length) continue;
      if (crypto.timingSafeEqual(esperado, b)) return true;
    }
    return false;
  } catch (e) {
    // No se silencia el error real (p. ej. scrypt no disponible): queda en el log.
    console.error("[auth] error al verificar contraseña:", e);
    return false;
  }
}

/** Valida longitud mínima de contraseña nueva (8+). */
export function passwordValida(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}
