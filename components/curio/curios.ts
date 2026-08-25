// The thirteen curios, and the art for each.
//
// Keys mirror the v_keys array in supabase/migrations/20260825000000_curios.sql,
// which is what the server rolls from. The Record<CurioKey, …> type below is the
// safety net: adding a key server-side without adding it here fails the build
// rather than shipping a curio the app cannot draw.
//
// Requires are static on purpose — Metro resolves them at bundle time, so the
// paths cannot be built from a variable.
//
// These point at assets/curio/*.webp, not the source PNGs in assets/. The
// originals are 21MB for thirteen icons; cropped to content and re-encoded at
// the size they actually render, the whole set plus shelves and backdrop is
// 0.62MB. Requiring the PNGs puts all 21MB in the app bundle.

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
    art: require('@/assets/curio/acorn.webp'),
  },
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
};

/** Cost of one pouch, and what a duplicate hands back. Mirrors the RPC. */
export const POUCH_COST = 40;
export const DUPLICATE_REFUND = 12;
