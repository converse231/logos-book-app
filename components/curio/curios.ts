// The thirteen curios, and the art for each.
//
// Keys mirror the v_keys array in supabase/migrations/20260825000000_curios.sql,
// which is what the server rolls from. The Record<CurioKey, …> type below is the
// safety net: adding a key server-side without adding it here fails the build
// rather than shipping a curio the app cannot draw.
//
// Requires are static on purpose — Metro resolves them at bundle time, so the
// paths cannot be built from a variable.

export const CURIO_KEYS = [
  'acorn', 'acorn-gold', 'berries', 'clover', 'egg', 'feather', 'lantern',
  'leaf', 'moonflower', 'mushroom', 'pebble', 'pinecone', 'snail',
] as const;

export type CurioKey = (typeof CURIO_KEYS)[number];

export interface CurioDef {
  name: string;
  /** One line, shown once the curio is found. Flavour, not lore. */
  blurb: string;
  art: number;
}

export const CURIOS: Record<CurioKey, CurioDef> = {
  acorn: {
    name: 'Acorn',
    blurb: 'A whole oak, waiting.',
    art: require('@/assets/tok-acorn.png'),
  },
  'acorn-gold': {
    name: 'Gilded Acorn',
    blurb: 'Nobody agrees on who gilded it.',
    art: require('@/assets/tok-acorn-gold.png'),
  },
  berries: {
    name: 'Wild Strawberry',
    blurb: 'Sweeter than the ones that are grown for it.',
    art: require('@/assets/tok-berries.png'),
  },
  clover: {
    name: 'Four-Leaf Clover',
    blurb: 'Found by looking for something else.',
    art: require('@/assets/tok-clover.png'),
  },
  egg: {
    name: 'Speckled Egg',
    blurb: 'Empty, and left behind on purpose.',
    art: require('@/assets/tok-egg.png'),
  },
  feather: {
    name: 'Barred Feather',
    blurb: 'Dropped mid-flight, never missed.',
    art: require('@/assets/tok-feather.png'),
  },
  lantern: {
    name: 'Little Lantern',
    blurb: 'Somebody reads by this.',
    art: require('@/assets/tok-lantern.png'),
  },
  leaf: {
    name: 'Turned Leaf',
    blurb: 'It only goes red on the way out.',
    art: require('@/assets/tok-leaf.png'),
  },
  moonflower: {
    name: 'Moonflower',
    blurb: 'Opens after everyone has gone in.',
    art: require('@/assets/tok-moonflower.png'),
  },
  mushroom: {
    name: 'Toadstool',
    blurb: 'Admire it. That is all.',
    art: require('@/assets/tok-mushroom.png'),
  },
  pebble: {
    name: 'River Pebble',
    blurb: 'Took the water a few thousand years.',
    art: require('@/assets/tok-pebble.png'),
  },
  pinecone: {
    name: 'Pinecone',
    blurb: 'Closed when wet, open when dry.',
    art: require('@/assets/tok-pinecone.png'),
  },
  snail: {
    name: 'Empty Shell',
    blurb: 'The snail moved on. The spiral stayed.',
    art: require('@/assets/tok-snail.png'),
  },
};

/** Cost of one pouch, and what a duplicate hands back. Mirrors the RPC. */
export const POUCH_COST = 40;
export const DUPLICATE_REFUND = 12;
