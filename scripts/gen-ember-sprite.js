// Bakes the ember glow sprite: a white radial falloff whose alpha is the particle
// shape. EmberField tints it per-particle (RN `tintColor` recolours by alpha), so
// one 96px PNG serves every colour in the blackbody ramp.
//   node scripts/gen-ember-sprite.js
const sharp = require('sharp');
const path = require('path');

const svg = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#fff" stop-opacity="1"/>
      <stop offset="32%"  stop-color="#fff" stop-opacity="0.42"/>
      <stop offset="66%"  stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="96" height="96" fill="url(#g)"/>
</svg>`;

const out = path.join(__dirname, '..', 'assets', 'textures', 'ember.png');
sharp(Buffer.from(svg)).png().toFile(out).then(() => console.log('wrote', out));
