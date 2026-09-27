// Genera los iconos PNG de la PWA sin dependencias (rasterización y PNG a mano):
// public/icons/icon-192.png, icon-512.png, icon-maskable-512.png y public/apple-touch-icon.png.
// Marca: hoja oro sobre «night» (el Wordmark del Design System). Relanzar si cambia la marca: node scripts/icones.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const NIGHT = [0x1f, 0x0f, 0x3d];
const GOLD = [0xe0, 0xb1, 0x2f];
const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Distancia con signo a la hoja: lente (intersección de dos discos) girada 45°, en coordenadas unitarias [-1, 1]. */
function distanceFeuille(x, y) {
  // Giro de −45° para que la hoja apunte arriba a la derecha.
  const c = Math.SQRT1_2;
  const u = (x + y) * c;
  const v = (y - x) * c;
  // Lente: dos discos de radio r con centros en ±d sobre el eje v; largo ≈ 1,1, ancho ≈ 0,55.
  const r = 0.72;
  const d = 0.44;
  const d1 = Math.hypot(u, v - d) - r;
  const d2 = Math.hypot(u, v + d) - r;
  const lente = Math.max(d1, d2);
  // Tallo: segmento fino que sale por abajo.
  const ty = Math.min(Math.max(u, -0.98), -0.45);
  const tallo = Math.hypot(u - ty, v) - 0.045;
  return Math.min(lente, tallo);
}

/** Nervio central: banda estrecha del color de fondo a lo largo de la hoja. */
function surNervure(x, y) {
  const c = Math.SQRT1_2;
  const u = (x + y) * c;
  const v = (y - x) * c;
  return Math.abs(v) < 0.035 && u > -0.45 && u < 0.62;
}

function rasteriser(taille, { maskable, ios }) {
  const px = new Uint8Array(taille * taille * 4);
  const ss = 3; // supermuestreo 3×3
  const rayonCoin = maskable || ios ? 0 : taille * 0.2;
  const echelle = maskable ? 0.28 : 0.36; // zona segura del maskable: 80 % central
  for (let j = 0; j < taille; j++) {
    for (let i = 0; i < taille; i++) {
      let fond = 0;
      let feuille = 0;
      let nervure = 0;
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const cx = i + (si + 0.5) / ss;
          const cy = j + (sj + 0.5) / ss;
          // Fondo: cuadrado redondeado (o pleno).
          const ddx = Math.max(rayonCoin - cx, cx - (taille - rayonCoin), 0);
          const ddy = Math.max(rayonCoin - cy, cy - (taille - rayonCoin), 0);
          if (Math.hypot(ddx, ddy) <= rayonCoin) fond++;
          const x = (cx / taille - 0.5) / echelle;
          const y = (cy / taille - 0.5) / echelle;
          if (distanceFeuille(x, y) <= 0) {
            feuille++;
            if (surNervure(x, y)) nervure++;
          }
        }
      }
      const n = ss * ss;
      const aFond = fond / n;
      const aFeuille = (feuille - nervure) / n;
      const o = (j * taille + i) * 4;
      for (let k = 0; k < 3; k++) {
        const base = NIGHT[k];
        px[o + k] = Math.round(base * (1 - aFeuille) + GOLD[k] * aFeuille);
      }
      px[o + 3] = Math.round(255 * aFond);
    }
  }
  return px;
}

const TABLE_CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(taille, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  const brut = Buffer.alloc((taille * 4 + 1) * taille);
  for (let j = 0; j < taille; j++) {
    brut[j * (taille * 4 + 1)] = 0; // filtro none
    Buffer.from(px.buffer, j * taille * 4, taille * 4).copy(brut, j * (taille * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(racine, 'icons'), { recursive: true });
const sorties = [
  ['icons/icon-192.png', 192, { maskable: false, ios: false }],
  ['icons/icon-512.png', 512, { maskable: false, ios: false }],
  ['icons/icon-maskable-512.png', 512, { maskable: true, ios: false }],
  ['apple-touch-icon.png', 180, { maskable: false, ios: true }],
];
for (const [chemin, taille, options] of sorties) {
  writeFileSync(join(racine, chemin), png(taille, rasteriser(taille, options)));
  console.log(`✓ public/${chemin} (${taille}×${taille})`);
}
