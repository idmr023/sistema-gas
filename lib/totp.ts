import "./env";
import crypto from "node:crypto";
import { Secret, TOTP } from "otpauth";

/**
 * TOTP (2FA) para Google Authenticator.
 * El secreto se guarda cifrado en BD (AES-256-GCM con clave derivada de AUTH_SECRET).
 */

function claveCifrado(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en .env");
  return crypto.scryptSync(secret, "sistema-gas-totp", 32);
}

export function cifrarSecreto(secreto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", claveCifrado(), iv);
  const enc = Buffer.concat([cipher.update(secreto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function descifrarSecreto(dato: string | null | undefined): string | null {
  if (!dato) return null;
  try {
    const [ivB, tagB, dataB] = dato.split(".");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      claveCifrado(),
      Buffer.from(ivB, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function generarSecreto(nombre: string): string {
  const totp = new TOTP({
    issuer: "Sistema de Gas",
    label: nombre,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new Secret({ size: 20 }),
  });
  return totp.secret.base32;
}

export function urlQr(nombre: string, secreto: string): string {
  const totp = new TOTP({
    issuer: "Sistema de Gas",
    label: nombre,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secreto,
  });
  return totp.toString();
}

/** Verifica código TOTP con ±1 ventana de desfase (30s). */
export function verificarTotp(secreto: string, codigo: string): boolean {
  const limpio = String(codigo).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpio)) return false;
  const totp = new TOTP({
    issuer: "Sistema de Gas",
    label: "verify",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secreto,
  });
  try {
    return totp.validate({ token: limpio, window: 1 }) !== null;
  } catch {
    return false;
  }
}
