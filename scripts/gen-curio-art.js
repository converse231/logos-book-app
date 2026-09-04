// Curio art pipeline: source PNG -> shipped WEBP.
//
//   node scripts/gen-curio-art.js
//
// The source art is 1024-1536px PNGs at ~2MB each. Requiring those puts every
// megabyte in the app bundle for icons that render at ~68px on a shelf, so each
// one is cropped to its content and re-encoded at the size it is actually drawn.
//
// The geometry is load-bearing, not cosmetic. Every curio lands on a 320x320
// transparent canvas, scaled so its longest side fills the canvas, then
// HORIZONTALLY CENTRED and BOTTOM-ALIGNED. Bottom-aligned is what gives the
// whole shelf one ground line — app/collection.tsx stands each item on the
// plank's visible top surface with no drawn shadow, so contact is carried by
// placement alone. An item padded to centre would float.
//
// Verified against set one: acorn.webp is 249x320 content at left -36 (centred)
// and top 0 (bottom-aligned). This script reproduces that exactly.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', 'assets');
const OUT = path.join(ROOT, 'curio');

/** Canvas edge, and the encode. ~30KB per curio, which lands within a kilobyte
 *  of set one's hand-encoded webps — so a full re-run reproduces the shipped art
 *  instead of quietly softening thirteen files that were already right. */
const SIZE = 320;
const WEBP = { quality: 89, alphaQuality: 100, effort: 5 };

/** Tier badges: emblems, so CENTRED on their canvas rather than bottom-aligned
 *  like the curios (a wax seal does not stand on the shelf, it sits beside it).
 *  Rendered at ~46dp, so 192 is 3x with headroom. */
const BADGE = { size: 192, quality: 82, alphaQuality: 100, effort: 5 };
/** Luma below this is background. The badge art arrives on OPAQUE black, unlike
 *  the curios which came with real alpha — measured, the darkest paint inside a
 *  seal is L22 and the corners are L0, so a ramp to 26 keys the field without
 *  eating the oxblood's own shadows. */
const KEY_T = 26;

/** Backdrops are full-screen paintings behind a scrim, so they can go softer
 *  than the curios. q81 lands within a kilobyte of the hand-encoded bg-nook.webp
 *  that shipped with set one, so a full re-run does not quietly degrade it. */
const BG = { w: 820, h: 1230, quality: 81, effort: 5 };

/** Output name === the CURIO KEY, which is what components/curio/curios.ts
 *  requires and what open_pouch rolls. Set one's sources carry a `tok-` prefix
 *  that its keys do not (`tok-acorn.png` -> `acorn.webp`), so it is stripped
 *  here; set two's `lit-` prefix IS part of the key and stays. */
const keyOf = (src) => path.basename(src, '.png').replace(/^tok-/, '');

async function curio(src) {
  const name = keyOf(src);
  const trimmed = await sharp(src).trim({ threshold: 1 }).toBuffer();
  const fit = await sharp(trimmed)
    .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const { width, height } = await sharp(fit).metadata();
  const out = path.join(OUT, `${name}.webp`);
  await sharp(fit)
    .extend({
      // Bottom-aligned, horizontally centred. Odd remainders go left, which is
      // where sharp's own rounding puts them.
      top: SIZE - height,
      bottom: 0,
      left: Math.floor((SIZE - width) / 2),
      right: Math.ceil((SIZE - width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp(WEBP)
    .toFile(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`${name.padEnd(18)} ${width}x${height} -> ${SIZE}x${SIZE}  ${kb}KB`);
}

/**
 * Black-background art -> transparent PNG.
 *
 * Alpha is the pixel's own luminance ramped to KEY_T, which gives a soft
 * anti-aliased edge instead of the stair-stepped halo a hard threshold leaves.
 * The RGB is then UNPREMULTIPLIED (divided by that alpha) because every edge
 * pixel has already been blended toward black by the renderer — skip this and
 * the badge wears a dark fringe everywhere it meets the background.
 */
async function keyBlack(src) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const a = Math.min(1, l / KEY_T);
    out[j] = a > 0 ? Math.min(255, data[i] / a) : 0;
    out[j + 1] = a > 0 ? Math.min(255, data[i + 1] / a) : 0;
    out[j + 2] = a > 0 ? Math.min(255, data[i + 2] / a) : 0;
    out[j + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function badge(src) {
  const name = path.basename(src, '.png');
  const keyed = await keyBlack(src);
  const trimmed = await sharp(keyed).trim({ threshold: 1 }).toBuffer();
  const out = path.join(OUT, `${name}.webp`);
  await sharp(trimmed)
    .resize(BADGE.size, BADGE.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp(BADGE)
    .toFile(out);
  console.log(`${name.padEnd(18)} badge -> ${BADGE.size}x${BADGE.size}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
}

async function backdrop(src) {
  const name = path.basename(src, '.png');
  const out = path.join(OUT, `${name}.webp`);
  await sharp(src)
    .resize(BG.w, BG.h, { fit: 'cover' })
    .webp({ quality: BG.quality, effort: BG.effort })
    .toFile(out);
  console.log(`${name.padEnd(18)} backdrop -> ${BG.w}x${BG.h}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
}

(async () => {
  const args = process.argv.slice(2);
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /^(tok|lit|epic)-.*\.png$/.test(f))
    .filter((f) => !args.length || args.some((a) => f.includes(a)));

  for (const f of files) await curio(path.join(ROOT, f));

  for (const f of fs
    .readdirSync(ROOT)
    .filter((f) => /^tier-.*\.png$/.test(f))
    .filter((f) => !args.length || args.some((a) => f.includes(a)))) {
    await badge(path.join(ROOT, f));
  }

  // Every backdrop present. Encoding one no set references yet is harmless —
  // Metro only bundles what curios.ts actually requires.
  for (const f of fs.readdirSync(ROOT).filter((f) => /^bg-.*\.png$/.test(f))) {
    await backdrop(path.join(ROOT, f));
  }
})();
