import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';

const BODY = require('@/assets/jar/fly-body.webp');
const WING = require('@/assets/jar/fly-wing.webp');
const GLOW = require('@/assets/jar/glow.webp');

const BODY_AR = 176 / 173;
const WING_AR = 176 / 79;
/** Measured off fly-body.webp: the pale abdomen, as a fraction of the sprite. */
export const LANTERN = { x: 0.823, y: 0.817 };

/** Per-firefly constants, derived from an index so a re-render never reshuffles. */
export interface FlySpec {
  size: number;
  /** Drift, as a fraction of the containing box. */
  homeX: number; homeY: number;
  ampX: number; ampY: number;
  rateX: number; rateY: number;
  phaseX: number; phaseY: number;
  /** Flash cycle in seconds, and where in it this one starts. */
  period: number; offset: number;
  /** Wingbeat rate, so they don't buzz in unison either. */
  wing: number;
}

/** Deterministic pseudo-random from an index — same jar every render. */
export function flySpec(i: number, seed = 0): FlySpec {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * 12.9898 + n * 78.233 + seed * 3.71) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    size: 17 + r(1) * 8,
    homeX: 0.14 + r(2) * 0.72,
    homeY: 0.14 + r(3) * 0.72,
    // Wide enough to actually read as flight, and different per axis so the
    // path is a lissajous loop rather than a diagonal shuffle.
    ampX: 0.10 + r(4) * 0.16,
    ampY: 0.08 + r(5) * 0.13,
    rateX: 3.1 + r(6) * 3.4,
    rateY: 2.3 + r(7) * 3.1,
    phaseX: r(8) * Math.PI * 2,
    phaseY: r(9) * Math.PI * 2,
    period: 2.4 + r(10) * 2.6,
    offset: r(11),
    wing: 17 + r(12) * 9,
  };
}

/**
 * One firefly: a lissajous drift, a flash envelope, and beating wings.
 *
 * The glow is a pre-rendered radial sprite rather than a coloured View. A View
 * with a background colour and a shadow renders as a hard disc with a smear
 * around it — the falloff a real glow needs can't be expressed that way in RN,
 * and it reads as a flat blob at any size.
 */
export function Firefly({
  spec,
  clock,
  boxW,
  boxH,
  reduce,
  /** 0 = settled at home, 1 = flung outward along its own heading. */
  scatter,
}: {
  spec: FlySpec;
  clock: SharedValue<number>;
  boxW: number;
  boxH: number;
  reduce: boolean;
  scatter?: SharedValue<number>;
}) {
  const R = spec.size;
  const bodyH = R / BODY_AR;

  const container = useAnimatedStyle(() => {
    'worklet';
    const t = clock.value;
    const dx = Math.sin(t / spec.rateX + spec.phaseX) * spec.ampX;
    const dy = Math.cos(t / spec.rateY + spec.phaseY) * spec.ampY;
    let x = (spec.homeX + dx) * boxW - R / 2;
    let y = (spec.homeY + dy) * boxH - bodyH / 2;

    // Scatter: keep looping, but let the loop grow and travel outward so they
    // spiral away crossing each other rather than firing off in straight lines.
    const s = scatter ? scatter.value : 0;
    if (s > 0) {
      const heading = spec.phaseX + spec.phaseY;
      const spin = t * 2.4 + spec.offset * 6.28;
      const reach = s * Math.max(boxW, boxH) * 1.25;
      x += Math.cos(heading) * reach + Math.cos(spin) * s * 46;
      y += Math.sin(heading) * reach + Math.sin(spin) * s * 46;
    }
    return { transform: [{ translateX: x }, { translateY: y }], opacity: 1 - (s > 0 ? s * s : 0) };
  }, [boxW, boxH]);

  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.55, transform: [{ scale: 1 }] };
    const t = clock.value;
    const u = (((t / spec.period + spec.offset) % 1) + 1) % 1;
    const ATTACK = 0.05;
    const DECAY = 0.2;
    let l = 0;
    if (u < ATTACK) l = u / ATTACK;
    else if (u < ATTACK + DECAY) l = Math.pow(1 - (u - ATTACK) / DECAY, 1.8);
    // Fine jitter so the light has texture instead of a clean ramp.
    if (l > 0) l = Math.min(1, l * (1 + Math.sin(t * 34 + spec.offset * 9) * 0.09));
    return { opacity: l, transform: [{ scale: 0.55 + l * 0.75 }] };
  }, [reduce]);

  const bodyStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.85 };
    const t = clock.value;
    const u = (((t / spec.period + spec.offset) % 1) + 1) % 1;
    const lit = u < 0.25 ? 1 - u / 0.25 : 0;
    return { opacity: 0.45 + lit * 0.55 };
  }, [reduce]);

  const wingStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.26, transform: [{ scaleY: 0.7 }] };
    const t = clock.value;
    return {
      opacity: 0.24,
      transform: [{ scaleY: 0.25 + Math.abs(Math.sin(t * spec.wing)) * 0.75 }],
    };
  }, [reduce]);

  const glowR = R * 3.4;
  const wingW = R * 0.9;
  const wingH = wingW / WING_AR;

  return (
    <Animated.View
      style={[styles.fly, { width: R, height: bodyH }, container]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.abs,
          {
            width: glowR * 2,
            height: glowR * 2,
            left: LANTERN.x * R - glowR,
            top: LANTERN.y * bodyH - glowR,
          },
          glowStyle,
        ]}
      >
        <Image source={GLOW} style={styles.fill} contentFit="contain" transition={0} />
      </Animated.View>

      {[-1, 1].map((s) => (
        <View
          key={s}
          style={[
            styles.abs,
            { width: wingW, height: wingH, left: R * 0.18, top: bodyH * 0.14, transform: [{ scaleX: s }] },
          ]}
        >
          <Animated.View style={[styles.fill, wingStyle]}>
            <Image source={WING} style={styles.fill} contentFit="contain" transition={0} />
          </Animated.View>
        </View>
      ))}

      <Animated.View style={[styles.fill, bodyStyle]}>
        <Image source={BODY} style={styles.fill} contentFit="contain" transition={0} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fly: { position: 'absolute', left: 0, top: 0 },
  abs: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
});
