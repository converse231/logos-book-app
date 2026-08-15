/*
 * Builds the ember lab — the browser reference for the streak-banner ember layer
 * (components/home/EmberField.tsx). Inlines the app's fonts and four real banner
 * scenes into one self-contained HTML file, then runs the simulation headlessly
 * and asserts the containment invariant the whole design hangs on.
 *
 *   node scripts/ember-lab/build.js && open scripts/ember-lab/ember-lab.html
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'ember-lab.html');

const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
const font = (p) => b64(path.join(ROOT, 'node_modules/@expo-google-fonts', p), 'font/ttf');
const img = (p) => b64(path.join(ROOT, 'assets/streak-hero', p), 'image/webp');

const ASSETS = {
  __F_FRAUNCES__: font('fraunces/700Bold/Fraunces_700Bold.ttf'),
  __F_SCHIB_400__: font('schibsted-grotesk/400Regular/SchibstedGrotesk_400Regular.ttf'),
  __F_SCHIB_700__: font('schibsted-grotesk/700Bold/SchibstedGrotesk_700Bold.ttf'),
  __F_MONO_500__: font('jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
  __F_MONO_700__: font('jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
  __IMG_NIGHT__: img('night.webp'),
  __IMG_ATRISK__: img('atRisk.webp'),
  __IMG_MONTH__: img('month.webp'),
  __IMG_LEGEND__: img('legend.webp'),
};

let html = fs.readFileSync(path.join(__dirname, 'lab.template.html'), 'utf8');
for (const [k, v] of Object.entries(ASSETS)) html = html.split(k).join(v);

const leftover = html.match(/__[A-Z_]+__/g);
if (leftover) throw new Error('unreplaced placeholders: ' + [...new Set(leftover)].join(', '));

fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT}  ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB`);

/* --------------------------------------------------------------------------
 * Headless check. The one thing that must never regress: embers stay on the
 * right side of the banner. Runs the real loop against a stub DOM at every
 * tier, flaring and gusting (the densest, fastest state there is), and reads
 * the leftmost visible particle straight off the lab's own telemetry.
 * -------------------------------------------------------------------------- */
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const els = new Map();
const on = new Map();

function stub(id) {
  if (els.has(id)) return els.get(id);
  const e = {
    id, value: '0.3', textContent: '', className: '', style: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, getAttribute: () => 'false',
    appendChild(c) { this.children.push(c); },
    addEventListener(ev, fn) { on.set(`${id}:${ev}`, fn); },
    getBoundingClientRect: () => ({ width: 900, height: 375 }),
    getContext: () => ctx,
    width: 0, height: 0,
  };
  els.set(id, e);
  return e;
}

const grad = { addColorStop() {} };
const ctx = {
  setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {},
  rect() {}, clip() {}, fillRect() {}, arc() {}, fill() {}, moveTo() {},
  lineTo() {}, stroke() {}, createRadialGradient: () => grad,
  fillStyle: '', strokeStyle: '', globalCompositeOperation: '', lineWidth: 0, lineCap: '',
};

let queued = null;
const env = {
  document: {
    getElementById: stub,
    createElement: () => stub('tmp' + els.size),
    addEventListener() {},
    hidden: false,
  },
  window: { devicePixelRatio: 2, matchMedia: () => ({ matches: false, addEventListener() {} }) },
  ResizeObserver: class { observe() {} },
  IntersectionObserver: class { constructor(cb) { cb([{ isIntersecting: true }]); } observe() {} },
  requestAnimationFrame: (cb) => { queued = cb; return 1; },
  cancelAnimationFrame: () => { queued = null; },
};
const keys = Object.keys(env);
new Function(...keys, script)(...keys.map((k) => env[k]));

const dial = stub('dial');
const minxEl = stub('minx');
const aliveEl = stub('tAlive');

let t = 0;
let worst = 1;
let peak = 0;

for (const I of [0, 0.18, 0.3, 0.48, 0.68, 0.87, 1]) {
  dial.value = String(I);
  on.get('dial:input')();
  on.get('flare:click')();
  on.get('gust:click')();
  for (let f = 0; f < 420; f++) {
    const cb = queued;
    assert.ok(cb, 'animation loop stopped unexpectedly');
    queued = null;
    cb((t += 16.667));
  }
  const m = minxEl.textContent;
  const alive = Number(aliveEl.textContent);
  if (m !== '—') {
    const v = Number(m);
    worst = Math.min(worst, v);
    assert.ok(v >= 0.55, `intensity ${I}: particle at x=${v}, left of the 0.55 floor`);
  }
  peak = Math.max(peak, alive);
  assert.ok(alive <= 220, `intensity ${I}: ${alive} particles alive, over the 220 cap`);
  console.log(`  I=${I.toFixed(2)}  alive=${String(alive).padStart(3)}  min-x=${m}`);
}

console.log(`\nOK — leftmost visible particle across the sweep: ${worst.toFixed(3)} (floor 0.550); peak alive ${peak}/220`);
