import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

const JAR = require('@/assets/jar/jar.webp');
const BODY = require('@/assets/jar/fly-body.webp');
const WING = require('@/assets/jar/fly-wing.webp');

/** Measured off jar.webp: the glass interior as a fraction of the image, so the
 *  fireflies stay inside the walls at any rendered size. */
const IN = { x: 0.152, y: 0.238, w: 0.712, h: 0.654 };
const JAR_AR = 561 / 760;
/** Measured off fly-body.webp: the pale abdomen sits here, not at the centre —
 *  anchoring the lantern anywhere else makes the light look stuck on rather
 *  than shining out of the bug. */
const LANTERN = { x: 0.823, y: 0.817 };
const BODY_AR = 176 / 173;
const WING_AR = 176 / 79;

/** How many bugs to actually draw. A balance of 500 doesn't mean 500 sprites —
 *  the jar reads as a progress bar toward the next pouch, and saturates. */
const MAX_FLIES = 26;
export const POUCH_COST = 100;

export function visibleFlies(balance: number): number {
  if (balance <= 0) return 0;
  return Math.max(1, Math.min(MAX_FLIES, Math.round((balance / POUCH_COST) * MAX_FLIES)));
}

interface Props {
  /** Firefly balance. Drives how full the jar looks. */
  balance: number;
  /** Rendered width in dp; height follows the jar's aspect. */
  width: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The jar, with a live firefly for every slice of the balance.
 *
 * Deliberately NOT a physics simulation. Fireflies float — no gravity, no
 * stacking, no collisions to resolve — so each one only needs two drifting sine
 * waves and a flash envelope. That is a few multiplications per frame per bug
 * on the UI thread, rather than the constraint solver a jar of falling objects
 * would have needed.
 */
export function FireflyJar({ balance, width, style }: Props) {
  const height = width / JAR_AR;
  const reduce = useReducedMotion();

  // Interior box in dp — every fly is positioned inside this.
  const box = useMemo(
    () => ({
      x: width * IN.x,
      y: height * IN.y,
      w: width * IN.w,
      h: height * IN.h,
    }),
    [width, height]
  );

  const count = visibleFlies(balance);

  // One clock for the whole jar. Each fly reads it at its own phase and rate, so
  // they never move or flash in lockstep, and there is only one animation
  // driver no matter how many bugs are on screen.
  const clock = useSharedValue(0);
  useMemo(() => {
    if (reduce) return;
    clock.value = withRepeat(
      withTiming(1, { duration: 60_000, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduce, clock]);

  const flies = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic per index — the same balance always draws the same jar,
        // so a re-render never makes the fireflies jump.
        const r = (n: number) => {
          const s = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
          return s - Math.floor(s);
        };
        return {
          key: i,
          size: 15 + r(1) * 7,
          homeX: 0.12 + r(2) * 0.76,
          homeY: 0.12 + r(3) * 0.76,
          driftX: 0.05 + r(4) * 0.07,
          driftY: 0.04 + r(5) * 0.06,
          rateX: 5 + r(6) * 4,
          rateY: 4 + r(7) * 4,
          phaseX: r(8) * Math.PI * 2,
          phaseY: r(9) * Math.PI * 2,
          // Each bug flashes on its own 2–5s cycle.
          period: 2.2 + r(10) * 2.8,
          offset: r(11),
        };
      }),
    [count]
  );

  return (
    <View style={[{ width, height }, style]}>
      <Image source={JAR} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
      <View style={[styles.interior, { left: box.x, top: box.y, width: box.w, height: box.h }]}>
        {flies.map((f) => (
          <Firefly key={f.key} f={f} box={box} clock={clock} reduce={reduce} />
        ))}
      </View>
      {/* The glass again, additively, so its highlights fall ON the fireflies
          rather than behind them — that's what puts them inside the jar. */}
      <Image
        source={JAR}
        style={[StyleSheet.absoluteFill, styles.glass]}
        contentFit="contain"
        transition={0}
        pointerEvents="none"
      />
    </View>
  );
}

type Spec = ReturnType<typeof buildSpec>;
function buildSpec() {
  return {
    key: 0, size: 0, homeX: 0, homeY: 0, driftX: 0, driftY: 0,
    rateX: 0, rateY: 0, phaseX: 0, phaseY: 0, period: 0, offset: 0,
  };
}

function Firefly({
  f,
  box,
  clock,
  reduce,
}: {
  f: Spec;
  box: { x: number; y: number; w: number; h: number };
  clock: { value: number };
  reduce: boolean;
}) {
  const R = f.size;

  // Position: two slow sine waves around a fixed home. Cheap, and it never
  // needs the fly to know about any other fly.
  const pos = useAnimatedStyle(() => {
    'worklet';
    const t = clock.value * 60; // seconds
    const dx = Math.sin(t / f.rateX + f.phaseX) * f.driftX;
    const dy = Math.cos(t / f.rateY + f.phaseY) * f.driftY;
    return {
      transform: [
        { translateX: (f.homeX + dx) * box.w - R / 2 },
        { translateY: (f.homeY + dy) * box.h - R / 2 },
      ],
    };
  }, [box.w, box.h]);

  // Flash, not glow: a fast rise, a slower fall, then dark for the rest of the
  // cycle. A smooth pulse reads as a breathing lamp; this reads as an insect.
  const lum = useDerivedValue(() => {
    'worklet';
    if (reduce) return 0.6;
    const t = clock.value * 60;
    const u = ((t / f.period + f.offset) % 1 + 1) % 1;
    const ATTACK = 0.06;
    const DECAY = 0.22;
    if (u < ATTACK) return u / ATTACK;
    if (u < ATTACK + DECAY) return Math.pow(1 - (u - ATTACK) / DECAY, 1.7);
    return 0;
  }, [reduce]);

  const bodyStyle = useAnimatedStyle(() => ({ opacity: 0.5 + lum.value * 0.5 }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lum.value,
    transform: [{ scale: 0.7 + lum.value * 0.5 }],
  }));
  const wingStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.3 };
    const t = clock.value * 60;
    return { opacity: 0.26 + lum.value * 0.2, transform: [{ scaleY: 0.3 + Math.abs(Math.sin(t * 14)) * 0.7 }] };
  }, [reduce]);

  const bodyH = R / BODY_AR;
  const wingW = R * 0.95;
  const wingH = wingW / WING_AR;

  return (
    <Animated.View style={[styles.fly, { width: R, height: bodyH }, pos]} pointerEvents="none">
      {/* Halo, anchored to the abdomen rather than the sprite centre */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: R * 2.6,
            height: R * 2.6,
            borderRadius: R * 1.3,
            left: LANTERN.x * R - R * 1.3,
            top: LANTERN.y * bodyH - R * 1.3,
          },
          glowStyle,
        ]}
      />
      {[-1, 1].map((s) => (
        <Animated.View
          key={s}
          style={[
            styles.wing,
            { width: wingW, height: wingH, left: R * 0.2, top: bodyH * 0.16, transform: [{ scaleX: s }] },
            wingStyle,
          ]}
        >
          <Image source={WING} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>
      ))}
      <Animated.View style={[styles.fill, bodyStyle]}>
        <Image source={BODY} style={styles.fill} contentFit="contain" transition={0} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  interior: { position: 'absolute', overflow: 'hidden' },
  // expo-image has no additive blend, so a low-opacity overlay stands in. The
  // glass is mostly transparent, so what actually lands on the flies is its
  // highlights — which is the part that matters.
  glass: { opacity: 0.42 },
  fly: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  glow: {
    position: 'absolute',
    backgroundColor: '#FFD86B',
    shadowColor: '#FFC94A',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0,
  },
  wing: { position: 'absolute' },
});
