/**
 * Generates the PWA icons.
 *
 * Written as a script rather than committing PNGs by hand so the icon stays
 * editable: it's drawn from the same palette as the game, so when the art
 * direction changes (the blocks in src/render/palette.ts), you change these numbers
 * and re-run instead of trying to hand-edit a binary.
 *
 *   node scripts/make-icons.mjs
 *
 * No dependencies — it rasterises into an RGBA buffer and writes the PNG with
 * Node's built-in zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------------------------------------------------------------- raster ---

class Raster {
  constructor(size) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
  }

  /** Source-over blend of a solid colour, so translucent glow layers stack. */
  fillRect(x, y, w, h, [r, g, b], a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.size, Math.round(x + w));
    const y1 = Math.min(this.size, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.size + px) * 4;
        this.data[i] = this.data[i] * (1 - a) + r * a;
        this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
        this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
        this.data[i + 3] = 255;
      }
    }
  }

  verticalGradient(top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const t = y / (this.size - 1);
      const c = [0, 1, 2].map((k) => top[k] + (bottom[k] - top[k]) * t);
      this.fillRect(0, y, this.size, 1, c, 1);
    }
  }
}

// ------------------------------------------------------------------ png ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, body])));
  return Buffer.concat([length, typeBytes, body, crc]);
}

function encodePng(raster) {
  const { size, data } = raster;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 (none) is fine here
  // because the image is flat colour blocks and compresses well regardless.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
// ----------------------------------------------------------------- icon ----

// From BLOCKS and PALETTE in src/render/palette.ts, so the icon on the home
// screen looks like the game it opens: a T of toy blocks with a TNT crate in
// it, on the plum night of the playroom.
const NIGHT_TOP = [43, 33, 82];
const NIGHT_BOTTOM = [90, 60, 125];
const BLOCK = {
  purple: { face: [166, 108, 240], light: [210, 178, 255], dark: [106, 61, 179] },
  yellow: { face: [255, 210, 63], light: [255, 240, 154], dark: [201, 154, 18] },
  blue: { face: [63, 198, 240], light: [159, 230, 255], dark: [29, 127, 179] },
};
const TNT_RED = [200, 53, 43];
const TNT_DARK = [122, 28, 22];
const GOLD = [255, 210, 63];

function block(raster, x, y, s, look) {
  const pad = s * 0.04;
  raster.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2, look.dark);
  raster.fillRect(x + s * 0.1, y + s * 0.08, s * 0.8, s * 0.78, look.face);
  raster.fillRect(x + s * 0.1, y + s * 0.08, s * 0.8, s * 0.18, look.light);
  raster.fillRect(x + s * 0.2, y + s * 0.13, s * 0.35, s * 0.07, [255, 255, 255], 0.6);
}

function crate(raster, x, y, s) {
  const pad = s * 0.04;
  raster.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2, TNT_DARK);
  raster.fillRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, TNT_RED);
  raster.fillRect(x + s * 0.36, y + s * 0.12, s * 0.04, s * 0.76, TNT_DARK);
  raster.fillRect(x + s * 0.6, y + s * 0.12, s * 0.04, s * 0.76, TNT_DARK);
  // A gold band where the letters would be: letters don't survive 48 px.
  raster.fillRect(x + s * 0.18, y + s * 0.44, s * 0.64, s * 0.14, GOLD);
  // The fuse and its spark.
  raster.fillRect(x + s * 0.47, y - s * 0.12, s * 0.06, s * 0.16, [40, 30, 30]);
  raster.fillRect(x + s * 0.42, y - s * 0.22, s * 0.16, s * 0.12, GOLD);
}

function drawIcon(size) {
  const r = new Raster(size);
  r.verticalGradient(NIGHT_TOP, NIGHT_BOTTOM);
  // A few stars.
  for (const [fx, fy] of [[0.15, 0.14], [0.8, 0.1], [0.88, 0.32], [0.1, 0.42]]) {
    r.fillRect(size * fx, size * fy, size * 0.025, size * 0.025, [255, 255, 255], 0.8);
  }
  const s = size * 0.25;
  const x0 = (size - s * 3) / 2;
  const y0 = size * 0.14;
  // A T piece, the middle block a TNT crate, and a blue I lying underneath.
  block(r, x0, y0 + s, s, BLOCK.purple);
  crate(r, x0 + s, y0 + s, s);
  block(r, x0 + s * 2, y0 + s, s, BLOCK.purple);
  block(r, x0 + s, y0, s, BLOCK.purple);
  block(r, x0 - s * 0.5, y0 + s * 2, s, BLOCK.blue);
  block(r, x0 + s * 0.5, y0 + s * 2, s, BLOCK.yellow);
  block(r, x0 + s * 1.5, y0 + s * 2, s, BLOCK.yellow);
  block(r, x0 + s * 2.5, y0 + s * 2, s, BLOCK.blue);
  return r;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512, 180]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(drawIcon(size)));
}
console.log('icons written');
