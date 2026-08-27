// The curios, and the art for each.
//
// Keys mirror the per-set arrays in open_pouch (supabase/migrations/
// 20260827000000_curio_sets.sql), which is what the server rolls from. The
// Record<CurioKey, …> type below is the safety net: adding a key server-side
// without adding it here fails the build rather than shipping a curio the app
// cannot draw.
//
// Requires are static on purpose — Metro resolves them at bundle time, so the
// paths cannot be built from a variable.
//
// These point at assets/curio/*.webp, not the source PNGs in assets/. The
// originals are ~2MB each; cropped to content and re-encoded at the size they
// actually render they are 11-35KB, and both sets plus shelves and backdrops
// come to under 1MB. Requiring the PNGs puts all 45MB in the app bundle.
// scripts/gen-curio-art.js does that conversion and owns the geometry.

import type { CurioSetId } from '@/services/types';

/** Set one: things you pocket on a walk. Bare keys — these are already rows in
 *  user_curios, so they are NOT retro-prefixed. */
export const FOUND_KEYS = [
  'acorn-gold', 'berries', 'chamomile', 'clover', 'egg', 'feather', 'lantern',
  'leaf', 'moonflower', 'mushroom', 'pebble', 'pinecone', 'snail',
] as const;

/** Set two: objects out of books you have read. The `lit-` prefix IS the set
 *  dimension — client-side and in the RPC — so no set column exists anywhere. */
export const LIT_KEYS = [
  'lit-boot', 'lit-bow', 'lit-diamond', 'lit-eye', 'lit-goldfish',
  'lit-harpoon', 'lit-horseshoe', 'lit-notebook', 'lit-paintbox',
  'lit-portrait', 'lit-silk-shirt', 'lit-soma', 'lit-spectacles',
] as const;

export type CurioKey = (typeof FOUND_KEYS)[number] | (typeof LIT_KEYS)[number];

/** Every key, both sets, for looking one up without knowing where it lives. */
export const CURIO_KEYS: readonly CurioKey[] = [...FOUND_KEYS, ...LIT_KEYS];

export interface CurioDef {
  name: string;
  /** One line, shown once the curio is found. Flavour, not lore. */
  blurb: string;
  art: number;
}

export const CURIOS: Record<CurioKey, CurioDef> = {
  'acorn-gold': {
    name: 'Gilded Acorn',
    blurb: 'Nobody agrees on who gilded it.',
    art: require('@/assets/curio/acorn-gold.webp'),
  },
  berries: {
    name: 'Wild Strawberry',
    blurb: 'Sweeter than the ones that are grown for it.',
    art: require('@/assets/curio/berries.webp'),
  },
  chamomile: {
    name: 'Wild Chamomile',
    blurb: 'The more it gets walked on, the thicker it grows.',
    art: require('@/assets/curio/chamomile.webp'),
  },
  clover: {
    name: 'Four-Leaf Clover',
    blurb: 'Found by looking for something else.',
    art: require('@/assets/curio/clover.webp'),
  },
  egg: {
    name: 'Speckled Egg',
    blurb: 'Empty, and left behind on purpose.',
    art: require('@/assets/curio/egg.webp'),
  },
  feather: {
    name: 'Barred Feather',
    blurb: 'Dropped mid-flight, never missed.',
    art: require('@/assets/curio/feather.webp'),
  },
  lantern: {
    name: 'Little Lantern',
    blurb: 'Somebody reads by this.',
    art: require('@/assets/curio/lantern.webp'),
  },
  leaf: {
    name: 'Turned Leaf',
    blurb: 'It only goes red on the way out.',
    art: require('@/assets/curio/leaf.webp'),
  },
  moonflower: {
    name: 'Moonflower',
    blurb: 'Opens after everyone has gone in.',
    art: require('@/assets/curio/moonflower.webp'),
  },
  mushroom: {
    name: 'Toadstool',
    blurb: 'Admire it. That is all.',
    art: require('@/assets/curio/mushroom.webp'),
  },
  pebble: {
    name: 'River Pebble',
    blurb: 'Took the water a few thousand years.',
    art: require('@/assets/curio/pebble.webp'),
  },
  pinecone: {
    name: 'Pinecone',
    blurb: 'Closed when wet, open when dry.',
    art: require('@/assets/curio/pinecone.webp'),
  },
  snail: {
    name: 'Empty Shell',
    blurb: 'The snail moved on. The spiral stayed.',
    art: require('@/assets/curio/snail.webp'),
  },

  // ── Set two ────────────────────────────────────────────────────────────────
  // Each one is an object out of a novel, and the blurb deliberately never names
  // the book: recognising it is the whole point. Alphabetical, which is also
  // shelf order.
  'lit-boot': {
    name: "Cat's-Paw Boots",
    blurb: 'The tread is what gave them away.',
    art: require('@/assets/curio/lit-boot.webp'),
  },
  'lit-bow': {
    name: 'The Great Bow',
    blurb: 'Nobody else could string it.',
    art: require('@/assets/curio/lit-bow.webp'),
  },
  'lit-diamond': {
    name: 'The Great Diamond',
    blurb: 'It was payment, and it was a test.',
    art: require('@/assets/curio/lit-diamond.webp'),
  },
  'lit-eye': {
    name: 'The Eye',
    blurb: 'Torn down. Still watching.',
    art: require('@/assets/curio/lit-eye.webp'),
  },
  'lit-goldfish': {
    name: 'Little Gold Fish',
    blurb: 'Made, sold, and made again.',
    art: require('@/assets/curio/lit-goldfish.webp'),
  },
  'lit-harpoon': {
    name: 'Harpoon Iron',
    blurb: 'Thrown once, at one thing.',
    art: require('@/assets/curio/lit-harpoon.webp'),
  },
  'lit-horseshoe': {
    name: 'Worn Horseshoe',
    blurb: 'Whoever wore it worked harder.',
    art: require('@/assets/curio/lit-horseshoe.webp'),
  },
  'lit-notebook': {
    name: 'Black Notebook',
    blurb: 'Handed over by a man nobody looked at twice.',
    art: require('@/assets/curio/lit-notebook.webp'),
  },
  'lit-paintbox': {
    name: 'Tin Paintbox',
    blurb: 'He looked at her paintings longer than at her.',
    art: require('@/assets/curio/lit-paintbox.webp'),
  },
  'lit-portrait': {
    name: 'Portrait Miniature',
    blurb: 'Seen for the first time in his own house.',
    art: require('@/assets/curio/lit-portrait.webp'),
  },
  'lit-silk-shirt': {
    name: 'Folded Silk Shirt',
    blurb: 'She cried at the sight of them.',
    art: require('@/assets/curio/lit-silk-shirt.webp'),
  },
  'lit-soma': {
    name: 'Tube of Tablets',
    blurb: 'Two before bed. Nothing to discuss.',
    art: require('@/assets/curio/lit-soma.webp'),
  },
  'lit-spectacles': {
    name: 'Wire Spectacles',
    blurb: 'Set down before the one shot he ever took.',
    art: require('@/assets/curio/lit-spectacles.webp'),
  },
};

/**
 * A collection: its shelf, its backdrop, and the words on it.
 *
 * Two sets share one screen and one currency. A pouch is bought FOR a set, so
 * neither collection stalls behind the other and completion stays reachable —
 * a single 24-key hat would roughly double time-to-finish for both.
 */
export interface CurioSet {
  id: CurioSetId;
  /** Screen title. */
  name: string;
  /** Pill label. Two sit side by side, so keep it short. */
  short: string;
  sub: string;
  /** Shown once every curio in the set is found. */
  done: string;
  keys: readonly CurioKey[];
  bg: number;
  /** How hard the backdrop gets pushed back, as rgba(20,14,10,scrim) — a
   *  darkened translucent scrim, never a blur (house rule).
   *
   *  Per set because the paintings are nowhere near the same value: the nook is
   *  a bright amber interior and needs 0.44 for cream text to read on it, while
   *  the night library already sits at a third of that luminance. Reusing 0.44
   *  there crushed it to near-black, so the set read as "the screen went dark"
   *  instead of as somewhere else. */
  scrim: number;
}

export const SETS: readonly CurioSet[] = [
  {
    id: 'found',
    name: 'The forest floor',
    short: 'FOREST FLOOR',
    sub: 'Small things worth stopping for.',
    done: 'All thirteen found. Copies polish them from here.',
    keys: FOUND_KEYS,
    bg: require('@/assets/curio/bg-nook.webp'),
    scrim: 0.44,
  },
  {
    id: 'lit',
    name: 'Out of the books',
    short: 'THE BOOKS',
    sub: 'Left behind by somebody you have read.',
    done: 'All thirteen found. Copies polish them from here.',
    keys: LIT_KEYS,
    bg: require('@/assets/curio/bg-library.webp'),
    scrim: 0.22,
  },
];

/** Which set a curio belongs to. The prefix carries it, so a key found in the
 *  wild (a `focus` deep-link, a pouch result) needs no lookup table. */
export function setOf(key: string): CurioSetId {
  return key.startsWith('lit-') ? 'lit' : 'found';
}

export function setById(id: CurioSetId): CurioSet {
  return SETS.find((s) => s.id === id) ?? SETS[0];
}

/**
 * Copies raise a curio through tiers, so a finished collection still has
 * somewhere to go and duplicates stop being waste.
 *
 * Derived from user_curios.count, which the server already owns — there is no
 * tier column and there does not need to be. The roll weights toward whatever
 * you hold fewest of (see 20260826000000), so these fill roughly together
 * rather than one curio racing ahead.
 */
export const TIERS = [
  { at: 1, name: 'Found', art: require('@/assets/curio/tier-found.webp') },
  { at: 3, name: 'Polished', art: require('@/assets/curio/tier-polished.webp') },
  { at: 6, name: 'Gilded', art: require('@/assets/curio/tier-gilded.webp') },
  { at: 12, name: 'Luminous', art: require('@/assets/curio/tier-luminous.webp') },
] as const;

export interface CurioTier {
  /** -1 not found, then 0..3 indexing TIERS. */
  index: number;
  name: string | null;
  /** Copies this tier began at — the floor for a progress bar toward the next. */
  at: number;
  /** The wax seal for this tier, or null when the curio has not been found. */
  art: number | null;
  /** Copies still needed for the next tier, or null at the top. */
  toNext: number | null;
  nextName: string | null;
}

export function curioTier(count: number): CurioTier {
  let i = -1;
  for (let k = 0; k < TIERS.length; k++) if (count >= TIERS[k].at) i = k;
  const next = TIERS[i + 1];
  return {
    index: i,
    at: i < 0 ? 0 : TIERS[i].at,
    name: i < 0 ? null : TIERS[i].name,
    art: i < 0 ? null : TIERS[i].art,
    toNext: next ? next.at - count : null,
    nextName: next ? next.name : null,
  };
}

/**
 * How a tier reads on the shelf. Effects over the existing art rather than new
 * sprites — the whole point of tiers is that they cost no new content.
 */
export const TIER_LOOK: { glow: number; scale: number; tint: string; pulse: boolean }[] = [
  { glow: 0, scale: 1, tint: '#F3C24C', pulse: false },       // Found — plain
  { glow: 0.2, scale: 1.35, tint: '#F7E3A8', pulse: false },  // Polished — a warm breath
  { glow: 0.32, scale: 1.6, tint: '#F3C24C', pulse: false },  // Gilded — gold
  { glow: 0.4, scale: 1.8, tint: '#F3C24C', pulse: true },    // Luminous — gold, alive
];

/** Cost of one pouch, and what a duplicate hands back. Mirrors the RPC.
 *
 *  A duplicate refunds FIREFLIES and never XP. XP is the reading measure and it
 *  is what drives level_name, which is identity on share cards and in push — a
 *  currency you can spend must never be able to buy it. */
export const POUCH_COST = 40;
export const DUPLICATE_REFUND = 12;
