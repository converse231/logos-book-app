import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { AppState, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const EMBER = require('@/assets/textures/ember.png');

/*
 * Ambient ember field for the streak hero — the fire's heat spilling across the
 * right side of the banner, behind the day count.
 *
 * ONE shared clock drives everything. Each particle is a pure function of
 * (clock, intensity, its own seed) rather than a simulated body: age wraps on a
 * per-slot lifetime, and every wrap rehashes the seed so the next ember spawns
 * somewhere new. That means one shared-value write per frame instead of ~70,
 * no allocation in the hot path, and a legal static frame for free when
 * reduced-motion is on (freeze the clock, the field is already scattered).
 *
 * Intensity is a single 0..1 dial. Spawn density, size, rise speed, spread and
 * palette all hang off it, and it tweens rather than snapping when the streak
 * changes tier.
 */

const MAX_EMBERS = 84;
const MAX_SPARKS = 8; // fast bright arcs, only above SPARK_MIN_I
const SPARK_MIN_I = 0.38;
const SPRITE_PX = 40; // fixed view box; particles change scale, never layout
const LIFE_MS = 2600;
const SPARK_LIFE_MS = 1100;
const AVG_LIFE_S = LIFE_MS / 1000;
const TWEEN_MS = 1400;
const REF_W = 380; // px width the size constants were tuned against
const STATIC_T = 4200; // frozen clock for the reduced-motion single frame
const TAU = Math.PI * 2;

// Right-side containment. Embers spawn inside SPAWN_LO..SPAWN_HI and are faded
// out by FALLOFF so sway/wind can never march one into the artwork at full
// brightness — a hard clip would pop, this dissolves.
const SPAWN_LO = 0.62;
const SPAWN_HI = 0.95;
const FALL_ZERO = 0.58;
const FALL_FULL = 0.72;

// Blackbody ramp: red → orange → gold → white → blue, then violet past the
// physical end of it, which is what makes the 365-day tier feel earned.
// [at, core rgb, mid rgb, tail rgb, glow rgb]
const STOPS: number[][] = [
  [0.0, 255, 196, 140, 228, 108, 58, 142, 44, 28, 255, 92, 42],
  [0.3, 255, 228, 168, 255, 150, 62, 214, 68, 34, 255, 112, 46],
  [0.55, 255, 247, 210, 255, 192, 84, 234, 120, 40, 255, 162, 62],
  [0.74, 255, 255, 248, 214, 232, 255, 132, 178, 236, 176, 206, 255],
  [0.9, 236, 251, 255, 118, 198, 255, 52, 116, 224, 76, 158, 255],
  [1.0, 246, 226, 255, 188, 128, 255, 116, 56, 208, 158, 88, 255],
];
const FIXED_STOP = 1; // index of the 0.30 stop — the plain-orange lock

function rnd(n: number) {
  'worklet';
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}

function clamp01(v: number) {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Colour for a particle at age fraction `age01`, given the global intensity. */
function emberColor(intensity: number, age01: number, hot: boolean, shift: boolean) {
  'worklet';
  let lo = STOPS[FIXED_STOP];
  let hi = STOPS[FIXED_STOP];
  let f = 0;
  if (shift) {
    let i = 0;
    while (i < STOPS.length - 2 && intensity > STOPS[i + 1][0]) i++;
    lo = STOPS[i];
    hi = STOPS[i + 1];
    f = clamp01((intensity - lo[0]) / (hi[0] - lo[0]));
  }
  // Global gradient first: intensity picks the palette.
  const cr = lerp(lo[1], hi[1], f), cg = lerp(lo[2], hi[2], f), cb = lerp(lo[3], hi[3], f);
  const mr = lerp(lo[4], hi[4], f), mg = lerp(lo[5], hi[5], f), mb = lerp(lo[6], hi[6], f);
  const tr = lerp(lo[7], hi[7], f), tg = lerp(lo[8], hi[8], f), tb = lerp(lo[9], hi[9], f);

  // Then the per-particle gradient: each ember cools as it ages. "Hot" ones
  // never cool — they're the bright specks that stop the field reading as
  // uniform dots.
  if (hot) return `rgb(${cr | 0},${cg | 0},${cb | 0})`;
  const k = age01 < 0.45 ? age01 / 0.45 : (age01 - 0.45) / 0.55;
  const r = age01 < 0.45 ? lerp(cr, mr, k) : lerp(mr, tr, k);
  const g = age01 < 0.45 ? lerp(cg, mg, k) : lerp(mg, tg, k);
  const b = age01 < 0.45 ? lerp(cb, mb, k) : lerp(mb, tb, k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** The ambient-light stop, for the single glow sprite behind the field. */
function glowColor(intensity: number, shift: boolean) {
  'worklet';
  let lo = STOPS[FIXED_STOP];
  let hi = STOPS[FIXED_STOP];
  let f = 0;
  if (shift) {
    let i = 0;
    while (i < STOPS.length - 2 && intensity > STOPS[i + 1][0]) i++;
    lo = STOPS[i];
    hi = STOPS[i + 1];
    f = clamp01((intensity - lo[0]) / (hi[0] - lo[0]));
  }
  return `rgb(${lerp(lo[10], hi[10], f) | 0},${lerp(lo[11], hi[11], f) | 0},${lerp(lo[12], hi[12], f) | 0})`;
}

/** Ambient sway plus pseudo-random gusts, as a fraction of banner width. */
function wind(t: number, intensity: number, gustAt: number) {
  'worklet';
  let x = Math.sin(t / 2600) * 0.006 + Math.sin(t / 1700 + 1.3) * 0.004;
  // Scheduled gusts: each 900ms window either has one or doesn't, more often at
  // higher intensity. Deterministic, so no state to keep.
  const win = Math.floor(t / 900);
  if (rnd(win * 31.7) < 0.1 + 0.22 * intensity) {
    const p = (t % 900) / 900;
    x += Math.sin(p * Math.PI) * (rnd(win * 17.3) - 0.5) * 0.07;
  }
  // ...and the manual gust() trigger, same envelope.
  const dg = t - gustAt;
  if (dg >= 0 && dg < 900) x += Math.sin((dg / 900) * Math.PI) * 0.075;
  return x;
}

interface SlotProps {
  index: number;
  spark: boolean;
  clock: SharedValue<number>;
  inten: SharedValue<number>;
  flareAt: SharedValue<number>;
  gustAt: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  cap: number;
  shift: boolean;
}

const HIDDEN = { opacity: 0, tintColor: 'rgb(0,0,0)', transform: [{ translateX: -999 }, { translateY: -999 }, { scale: 1 }] };

function Slot({ index, spark, clock, inten, flareAt, gustAt, w, h, cap, shift }: SlotProps) {
  // Every branch returns the same style shape — Reanimated leaves omitted props
  // at their last value, so an early `{ opacity: 0 }` would strand a stale tint.
  const style = useAnimatedStyle(() => {
    const W = w.value;
    const H = h.value;
    if (W < 2 || H < 2) return HIDDEN;

    const t = clock.value;
    // flare() briefly lifts the whole field — brighter, faster, denser.
    const df = t - flareAt.value;
    const boost = df >= 0 && df < 1400 ? (1 - df / 1400) ** 1.5 : 0;
    const I = clamp01(inten.value + boost * 0.45);

    const life = (spark ? SPARK_LIFE_MS : LIFE_MS) * (0.7 + rnd(index * 3.7) * 0.6);
    // Stagger births so slots don't pulse in lockstep.
    const total = t + rnd(index * 5.1) * life * 7;
    const cycle = Math.floor(total / life);
    const age = total - cycle * life;
    const a01 = age / life;
    const s = index * 7919 + cycle * 104729; // reseeds every wrap → real variety

    // How many slots are alight right now. Still non-linear so the low tiers
    // read quieter than the high ones, just off a higher floor.
    const rate = 1.5 + 52 * Math.pow(I, 1.3);
    const want = Math.min(cap, rate * AVG_LIFE_S);
    const gain = spark
      ? I > SPARK_MIN_I
        ? clamp01((I - SPARK_MIN_I) / 0.25) * (rnd(s * 1.9) < 0.35 ? 1 : 0)
        : 0
      : clamp01(want - index);
    if (gain <= 0) return HIDDEN;

    const depth = 0.45 + rnd(s + 11) * 0.9; // parallax: size + speed + drift + alpha, together
    const spread = 0.18 + 0.15 * I;
    const x0 = Math.min(SPAWN_HI, Math.max(SPAWN_LO, 0.785 + (rnd(s + 23) - 0.5) * spread));
    const y0 = 0.9 + (rnd(s + 37) - 0.5) * 0.03;
    const baseR = 0.75 + rnd(s + 53) * 1.55;
    const swayAmp = (0.08 + rnd(s + 71) * 0.34) * 14;
    const phase = rnd(s + 97) * TAU;
    const hot = rnd(s + 113) < 0.15 + 0.35 * I;

    const ageS = age / 1000;
    const speed = (0.6 + 1.3 * I) * depth * (spark ? 2.6 : 1) * (1 + boost * 0.6);

    // Rise with a gentle upward decay — the closed form of v *= 0.9993 per
    // 60fps frame, so it's frame-rate independent by construction.
    const v0 = (0.1 + rnd(s + 131) * 0.1) * speed;
    const K = 0.042;
    let y = y0 - (v0 * (1 - Math.exp(-K * ageS))) / K;
    if (spark) y += 0.42 * ageS * ageS; // sparks arc: they fall back

    let x = x0 + (Math.sin(phase + ageS * 2.1) * swayAmp * depth) / W;
    x += wind(t, I, gustAt.value) * depth;

    // Nothing left of FALL_ZERO, ever; the ramp keeps the edge soft.
    const falloff = clamp01((x - FALL_ZERO) / (FALL_FULL - FALL_ZERO));
    if (falloff <= 0) return HIDDEN;

    const fade = a01 < 0.1 ? a01 / 0.1 : 1 - Math.pow((a01 - 0.1) / 0.9, 1.6);
    const flicker = 0.68 + Math.sin(age / 58 + phase) * 0.32;
    const size = baseR * (0.85 + 1.15 * I) * depth * (W / REF_W) * (spark ? 0.8 : 1);
    const alpha =
      clamp01(fade) *
      flicker *
      falloff *
      gain *
      (0.5 + depth * 0.55) *
      (0.72 + 0.28 * I) *
      (spark ? 1.35 : 1);

    return {
      opacity: clamp01(alpha),
      tintColor: emberColor(I, a01, hot || spark, shift),
      transform: [
        { translateX: x * W - SPRITE_PX / 2 },
        { translateY: y * H - SPRITE_PX / 2 },
        { scale: (size * 3.8 * 2) / SPRITE_PX },
      ],
    };
  });

  return <Animated.Image source={EMBER} style={[styles.sprite, style]} />;
}

/**
 * One ambient light wash under the field — the campfire's heat on the air.
 * Reuses the same radial sprite: centred at 0.82W with a 0.24W radius, its alpha
 * reaches zero right on the 0.58 falloff line, so it obeys the same containment
 * rule as the embers. Sits low (0.84H) so it never sits behind the day count.
 */
function Glow({
  clock,
  inten,
  flareAt,
  w,
  h,
  shift,
}: Pick<SlotProps, 'clock' | 'inten' | 'flareAt' | 'w' | 'h' | 'shift'>) {
  const style = useAnimatedStyle(() => {
    const W = w.value;
    const H = h.value;
    if (W < 2 || H < 2) return HIDDEN;
    const df = clock.value - flareAt.value;
    const boost = df >= 0 && df < 1400 ? (1 - df / 1400) ** 1.5 : 0;
    const I = clamp01(inten.value + boost * 0.45);
    return {
      opacity: 0.09 + 0.19 * I,
      tintColor: glowColor(I, shift),
      transform: [
        { translateX: 0.82 * W - SPRITE_PX / 2 },
        { translateY: 0.84 * H - SPRITE_PX / 2 },
        { scale: (W * 0.48) / SPRITE_PX },
      ],
    };
  });
  return <Animated.Image source={EMBER} style={[styles.sprite, style]} />;
}

export interface EmberFieldHandle {
  /** Burst of extra embers — fire this when the streak increments. */
  flare(): void;
  /** Sideways sweep — distinct from a flare; for achievement unlocks. */
  gust(): void;
}

interface EmberFieldProps {
  /** 0..1. See STREAK_TIERS. Changes tween over 1.4s rather than snapping. */
  intensity: number;
  /** false locks the palette to the 0.30 stop (plain orange). */
  hueShift?: boolean;
  maxParticles?: number;
  style?: StyleProp<ViewStyle>;
}

export const EmberField = forwardRef<EmberFieldHandle, EmberFieldProps>(function EmberField(
  { intensity, hueShift = true, maxParticles = MAX_EMBERS, style },
  ref,
) {
  const reduce = useReducedMotion();
  const clock = useSharedValue(STATIC_T);
  const inten = useSharedValue(clamp01(intensity));
  const flareAt = useSharedValue(-1e9);
  const gustAt = useSharedValue(-1e9);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const [awake, setAwake] = useState(true);

  const frame = useFrameCallback((f) => {
    'worklet';
    // Clamp the step so one dropped frame doesn't teleport the field.
    clock.value += Math.min(50, f.timeSincePreviousFrame ?? 16.7);
  }, false);

  useEffect(() => {
    inten.value = withTiming(clamp01(intensity), { duration: TWEEN_MS, easing: Easing.out(Easing.cubic) });
  }, [intensity, inten]);

  // Don't burn frames on a banner nobody is looking at.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAwake(s === 'active'));
    return () => sub.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      frame.setActive(!reduce && awake);
      return () => frame.setActive(false);
    }, [frame, reduce, awake]),
  );

  useImperativeHandle(ref, () => ({
    flare: () => {
      flareAt.value = clock.value;
    },
    gust: () => {
      gustAt.value = clock.value;
    },
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width;
    h.value = e.nativeEvent.layout.height;
  };

  const cap = Math.min(maxParticles, MAX_EMBERS);

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout} pointerEvents="none">
      <Glow clock={clock} inten={inten} flareAt={flareAt} w={w} h={h} shift={hueShift} />
      {Array.from({ length: MAX_EMBERS + MAX_SPARKS }, (_, i) => (
        <Slot
          key={i}
          index={i}
          spark={i >= MAX_EMBERS}
          clock={clock}
          inten={inten}
          flareAt={flareAt}
          gustAt={gustAt}
          w={w}
          h={h}
          cap={cap}
          shift={hueShift}
        />
      ))}
    </View>
  );
});

// ponytail: normal alpha compositing, not additive. The field only ever renders
// over the dark night scenes, where screen-blend and plain alpha are
// indistinguishable — and mixBlendMode forces an offscreen layer per view. If
// this ever sits on a bright scene, add `mixBlendMode: 'screen'` here and
// `isolation: 'isolate'` on the banner.
//
// ponytail: no spark motion trails. A trail is ~2px of smear on a 150dp-tall
// banner and costs a second stretched view per spark. The browser reference
// (`node scripts/ember-lab/build.js`) draws them if you want to compare.
const styles = StyleSheet.create({
  sprite: { position: 'absolute', left: 0, top: 0, width: SPRITE_PX, height: SPRITE_PX },
});

/** Named tiers from the spec, for callers that want to set intensity directly. */
export const STREAK_TIERS = {
  embers: 0.18,
  spark: 0.3,
  glow: 0.48,
  blaze: 0.68,
  coldFire: 0.87,
  violet: 1.0,
} as const;

const ANCHORS: [number, number][] = [
  [1, 0.3],
  [3, 0.3],
  [7, 0.48],
  [28, 0.68],
  [90, 0.87],
  [365, 1.0],
];

/** Streak length → intensity, interpolated so there is no visible tier step. */
export function streakIntensity(days: number, isAtRisk: boolean): number {
  if (isAtRisk || days <= 0) return STREAK_TIERS.embers;
  if (days >= 365) return 1;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [d0, v0] = ANCHORS[i];
    const [d1, v1] = ANCHORS[i + 1];
    if (days <= d1) {
      if (days <= d0) return v0;
      return v0 + ((v1 - v0) * (days - d0)) / (d1 - d0);
    }
  }
  return 1;
}
