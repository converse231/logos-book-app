// Generates the neubrutalist texture overlays as tiny tileable alpha PNGs:
//   assets/textures/grain.png  — film/paper grain (random alpha noise)
//   assets/textures/grid.png   — blueprint crosshair grid (one "+" per tile)
// Both are pure-alpha black; the app recolours them per-theme via Image tintColor
// and tiles them with resizeMode="repeat". Re-run with `node scripts/gen-textures.js`.

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// rgba: Buffer of width*height*4 (RGBA8)
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '..', 'assets', 'textures');
fs.mkdirSync(outDir, { recursive: true });

// ── grain.png — 200×200 random-alpha black noise ─────────────────────────────
{
  const W = 200, H = 200;
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    // bias toward sparse speckle so tiling never reads as a flat grey wash
    const r = Math.random();
    const a = r < 0.55 ? 0 : Math.floor(((r - 0.55) / 0.45) * 255);
    buf[i * 4 + 0] = 0;
    buf[i * 4 + 1] = 0;
    buf[i * 4 + 2] = 0;
    buf[i * 4 + 3] = a;
  }
  fs.writeFileSync(path.join(outDir, 'grain.png'), encodePng(W, H, buf));
}

// ── grid.png — 40×40 graph-paper cell: thin lines on the top + left edges ─────
// Tiling the edge lines yields a continuous blueprint grid (vs the old sparse
// crosshairs). A brighter pixel at the corner gives a faint registration dot.
{
  const W = 40, H = 40;
  const buf = Buffer.alloc(W * H * 4); // transparent
  const set = (x, y, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = a;
  };
  const LINE = 150; // line alpha (the overlay opacity scales this down further)
  for (let x = 0; x < W; x++) set(x, 0, LINE); // top edge  → horizontal lines
  for (let y = 0; y < H; y++) set(0, y, LINE); // left edge → vertical lines
  set(0, 0, 255);                              // crisp intersection dot
  fs.writeFileSync(path.join(outDir, 'grid.png'), encodePng(W, H, buf));
}

console.log('Wrote assets/textures/grain.png + grid.png');
