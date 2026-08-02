// Streak flame tiers — the TikTok-style "streak unlocked" moment.
//
// Two things had to be measured out of the artwork rather than assumed:
//
// 1. FRAMING. The flames were drawn at different crops — day 1's body occupies a
//    296×371 corner of a 1024×1536 frame, day 250's a 695×943 one. Rendered naively
//    they'd swing wildly in size. Each entry carries the measured box of the flame
//    BODY (alpha > 140), NOT of its glow: day 250's halo spreads to 864×1506, so
//    measuring the glow made its flame render 37% small and 68px high while every
//    other tier's halo hugs its body. `k` is a per-tier optical nudge for when two
//    flames measure alike but don't read alike.
// 2. RAY COLOUR. The rays and glow have to match the flame, and the flames progress
//    amber → gold → blue → violet → inferno. `ray` is the dominant vivid hue in the
//    art; `spark` is its secondary, used to tint the confetti. For days 100 and 150
//    the *dominant* hue is the deep navy body (#002FA4), which would be invisible as
//    a ray on a dark scrim — those two use the bright secondary instead.
//
// Metro resolves image assets only from literal require() calls, so the sources are
// spelled out. (Several filenames say "steak"; that's how they're on disk.)

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FlameTier {
  /** Streak day this flame belongs to. */
  day: number;
  source: number;
  /** Rays, glow, kicker, CTA. */
  ray: string;
  /** Confetti's second colour. */
  spark: string;
  /** Source artwork size + the measured box of the flame body inside it. */
  art: { w: number; h: number; x: number; y: number; bw: number; bh: number };
  /** Optical size nudge; 1 (default) = exactly as measured. */
  k?: number;
}

export const FLAME_TIERS: FlameTier[] = [
  { day: 1,    source: require('@/assets/streak-fires/day-1-streak.webp'),     ray: '#FF9602', spark: '#FF7100', art: { w: 1024, h: 1536, x: 363, y: 570, bw: 296, bh: 371 }, k: 0.88 },
  { day: 7,    source: require('@/assets/streak-fires/day-7-streak.webp'),     ray: '#FFB400', spark: '#FFC106', art: { w: 1024, h: 1536, x: 319, y: 414, bw: 394, bh: 565 } },
  { day: 14,   source: require('@/assets/streak-fires/day-14-steak.webp'),     ray: '#FFC107', spark: '#FFBE01', art: { w: 1024, h: 1536, x: 277, y: 343, bw: 475, bh: 665 } },
  { day: 30,   source: require('@/assets/streak-fires/day-30-streak.webp'),    ray: '#FF7A00', spark: '#EA3A00', art: { w: 1024, h: 1536, x: 239, y: 304, bw: 565, bh: 765 } },
  { day: 50,   source: require('@/assets/streak-fires/day-50-steak.webp'),     ray: '#FF8A00', spark: '#FFC10C', art: { w: 1024, h: 1536, x: 243, y: 298, bw: 543, bh: 759 } },
  { day: 67,   source: require('@/assets/streak-fires/day-67-steak.webp'),     ray: '#FFE014', spark: '#F10E00', art: { w: 1024, h: 1536, x: 48, y: 329, bw: 933, bh: 641 } },
  { day: 100,  source: require('@/assets/streak-fires/day-100-steak.webp'),    ray: '#1DBDF7', spark: '#FFD447', art: { w: 1024, h: 1024, x: 230, y: 158, bw: 591, bh: 687 } },
  { day: 150,  source: require('@/assets/streak-fires/day-150-steak.webp'),    ray: '#0A99FC', spark: '#FFD447', art: { w: 1024, h: 1024, x: 222, y: 157, bw: 593, bh: 682 } },
  { day: 200,  source: require('@/assets/streak-fires/day-200-steak.webp'),    ray: '#A87DF7', spark: '#BD7DF7', art: { w: 1024, h: 1536, x: 180, y: 267, bw: 661, bh: 829 } },
  { day: 250,  source: require('@/assets/streak-fires/day-250-steak.webp'),    ray: '#B75FE8', spark: '#AF59D1', art: { w: 1024, h: 1536, x: 172, y: 229, bw: 695, bh: 943 } },
  { day: 365,  source: require('@/assets/streak-fires/day-365-steak.webp'),    ray: '#FF5A18', spark: '#FDD54A', art: { w: 1024, h: 1536, x: 124, y: 283, bw: 766, bh: 908 } },
];

const BY_DAY = new Map(FLAME_TIERS.map((f) => [f.day, f]));

/** Exactly on a tier — the only days that earn the celebration. */
export const isStreakTier = (day: number): boolean => BY_DAY.has(day);

/** The tier for a day, falling back to the highest one already passed. */
export function flameForDay(day: number): FlameTier {
  return BY_DAY.get(day) ?? [...FLAME_TIERS].reverse().find((f) => f.day <= day) ?? FLAME_TIERS[0];
}

/**
 * Geometry that makes every flame render at the same visual size despite the
 * inconsistent crops: how big to draw the whole image, and how far to nudge it so
 * the artwork's centre lands in the middle of the box.
 */
export function flameLayout(tier: FlameTier, size: number) {
  const { w, h, x, y, bw, bh } = tier.art;
  const scale = (size * (tier.k ?? 1)) / Math.max(bw, bh);
  const width = w * scale;
  const height = h * scale;
  return {
    width,
    height,
    // content centre, in image space, offset back to the container's centre
    dx: -((x + bw / 2) / w - 0.5) * width,
    dy: -((y + bh / 2) / h - 0.5) * height,
  };
}

const KEY = 'quire.streakCelebrated.v1';

/**
 * Claim the celebration for this streak, if one is owed. Returns the day to
 * celebrate, or null.
 *
 * Deliberately driven off the streak COUNT rather than off a session result, so it
 * fires no matter how the day was logged — a live session, the "I read today"
 * check-in, or an offline session syncing later. Persisted so it fires once and
 * survives a relaunch; compared with `!==` rather than `>` so that a broken streak
 * starting over at day 1 earns its milestones again on the way back up.
 */
export async function takeStreakCelebration(currentStreak: number): Promise<number | null> {
  if (!isStreakTier(currentStreak)) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw !== null && Number(raw) === currentStreak) return null;
    await AsyncStorage.setItem(KEY, String(currentStreak));
    return currentStreak;
  } catch {
    return null; // never let a storage hiccup pop a celebration on every focus
  }
}
