/**
 * Genera los íconos de la PWA (PNG) sin dependencias externas.
 * Diseño: cilindro de gas blanco sobre fondo ámbar.
 * Uso: node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = join(raiz, "public", "icons");

const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

function png(width, height, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const bruto = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    bruto[y * (width * 4 + 1)] = 0; // filtro: ninguno
    pixeles.copy(bruto, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(bruto, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const AMBAR = [245, 158, 11];
const OSCURO = [180, 83, 9];
const BLANCO = [255, 255, 255];

function dentroRect(x, y, x0, y0, x1, y1, r = 0) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function dibujar(S) {
  const buf = Buffer.alloc(S * S * 4);
  const set = (i, [r, g, b]) => {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      set(i, AMBAR);

      const u = (v) => v * S;
      // Cuerpo del cilindro (esquinas redondeadas)
      if (dentroRect(x, y, u(0.32), u(0.36), u(0.68), u(0.84), u(0.07))) set(i, BLANCO);
      // Cuello
      if (dentroRect(x, y, u(0.44), u(0.26), u(0.56), u(0.37))) set(i, BLANCO);
      // Válvula / manija
      if (dentroRect(x, y, u(0.38), u(0.2), u(0.62), u(0.265), u(0.02))) set(i, BLANCO);
      // Banda de etiqueta
      if (dentroRect(x, y, u(0.32), u(0.52), u(0.68), u(0.62))) set(i, OSCURO);
      // Base
      if (dentroRect(x, y, u(0.32), u(0.79), u(0.68), u(0.84), u(0.04))) set(i, OSCURO);
    }
  }
  return buf;
}

mkdirSync(salida, { recursive: true });
for (const tam of [16, 32, 180, 192, 512]) {
  const archivo = tam <= 32 ? `favicon-${tam}.png` : `icon-${tam}.png`;
  writeFileSync(join(salida, archivo), png(tam, tam, dibujar(tam)));
  console.log("✓", archivo, `${tam}x${tam}`);
}
