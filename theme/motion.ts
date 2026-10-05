import { Easing, withSequence, withTiming } from 'react-native-reanimated';

/*
 * Quire's motion system — one set of curves for the whole app.
 *
 * The brief is "deluxe, not bouncy": things arrive decisively, decelerate for a
 * long, soft tail, and stop exactly where they belong. No overshoot, no wobble,
 * no springs that ring past rest. That feel is almost entirely the EASING, not
 * the duration — a long ease-out (expo-style) reads as weight and confidence,
 * where an underdamped spring reads as a toy.
 *
 * Before this module the app used 39 distinct literal durations and 21 distinct
 * spring configs, with the ANIMATION tokens referenced 3 times. Everything that
 * moves should now pull from here; add a curve here rather than inventing one
 * at the call site.
 */

export const EASE = {
  /** Default for anything arriving or settling. Fast start, very long tail. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** For state changes that move both ways (toggles, cross-fades). */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** For ambient loops (breathing, glows) — symmetric and slow. */
  breathe: Easing.bezier(0.37, 0, 0.63, 1),
  /** For press-in: definite, immediate, no drift. */
  press: Easing.bezier(0.3, 0, 0.2, 1),
} as const;

export const DURATION = {
  /** Press-in. Going down must feel immediate. */
  press: 90,
  /** Press release and small state changes. */
  release: 260,
  /** Icon swaps, colour and opacity changes. */
  quick: 200,
  /** Sheets, panels, most transitions. */
  base: 380,
  /** Entrances (Reveal stagger). */
  entrance: 560,
  /** A celebration's hero element settling into place. */
  hero: 820,
  /** Ambient breathing loops (one half-cycle). */
  breathe: 2600,
} as const;

/** Where a hero element starts before it settles to 1 — close enough to rest
 *  that the arrival reads as a reveal, not a pop. */
export const HERO_FROM = 0.84;

/** Settle to a value on the house ease-out. Safe to call from worklets. */
export function glide(to: number, duration: number = DURATION.base) {
  'worklet';
  return withTiming(to, { duration, easing: EASE.out });
}

/** A tap acknowledgement: rise to `peak`, then settle back — two eased legs,
 *  so it lands at exactly 1 instead of ringing through it like a spring. */
export function tapPulse(peak = 1.06) {
  'worklet';
  return withSequence(
    withTiming(peak, { duration: 130, easing: EASE.press }),
    withTiming(1, { duration: 420, easing: EASE.out })
  );
}
