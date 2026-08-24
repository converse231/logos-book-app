import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';

const BODY = require('@/assets/jar/fly-body.webp');
const WING = require('@/assets/jar/fly-wing.webp');
const GLOW = require('@/assets/jar/glow.webp');

/** All measured off the art, not guessed. The body is a side profile facing
 *  RIGHT: lantern at the tail (left), thorax toward the head (right). */
const BODY_AR = 200 / 101;
const WING_AR = 200 / 152;
/** Pale abdomen centroid, as a fraction of the body sprite. */
const LANTERN = { x: 0.237, y: 0.476 };
/** Where the wings hinge. Measured: the body's top edge over the thorax runs
 *  y 0.15-0.17, so the root tucks just inside it rather than floating above. */
const WING_HINGE = { x: 0.60, y: 0.19 };
/** The wing's narrow root, measured at x 0.000 y 0.933 — the bottom-LEFT corner,
 *  with the blade sweeping up-right. On a right-facing body that fans the wing
 *  forward over the head, so it's drawn mirrored (see Wing) and this anchor is
 *  in post-mirror coordinates: root bottom-RIGHT, blade sweeping back. */
const WING_ROOT = { x: 0.98, y: 0.93 };

export interface FlySpec {
  /** Sprite WIDTH — the body is nearly 2:1, so width is the honest dimension. */
  size: number;
  homeX: number; homeY: number;
  ampX: number; ampY: number;
  rateX: number; rateY: number;
  phaseX: number; phaseY: number;
  /** A faster second harmonic per axis, so the path never quite repeats. */
  ampX2: number; ampY2: number;
  rateX2: number; rateY2: number;
  period: number; offset: number;
  /** Wingbeat rate, and the far wing's lag behind the near one. */
  beat: number; beatLag: number;
  double: boolean;
}

/** Deterministic from the index — the same jar draws the same every render. */
export function flySpec(i: number, seed = 0): FlySpec {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * 12.9898 + n * 78.233 + seed * 3.71) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    size: 30 + r(1) * 16,
    // Home range plus max amplitude has to stay inside 0–1 or the fly clips on
    // the jar wall: 0.26..0.74 home and 0.18 total swing lands at 0.08..0.92,
    // which leaves room for the sprite's own half-width.
    homeX: 0.26 + r(2) * 0.48,
    homeY: 0.26 + r(3) * 0.48,
    ampX: 0.07 + r(4) * 0.07,
    ampY: 0.055 + r(5) * 0.055,
    // These are DIVISORS, so the period is 2*PI*rate. The old 3.7–7.6 meant a
    // 23–48 second sweep, which is barely motion at all; 1.1–2.5 gives a 7–16
    // second drift. Non-simple ratios between the axes so the path never closes
    // into a figure-eight the eye can learn.
    rateX: 1.1 + r(6) * 1.4,
    rateY: 0.9 + r(7) * 1.1,
    phaseX: r(8) * Math.PI * 2,
    phaseY: r(9) * Math.PI * 2,
    // The second harmonic must be FASTER than the first — fine wobble riding on
    // the slow drift. Smaller divisor, smaller amplitude.
    ampX2: 0.018 + r(10) * 0.022,
    ampY2: 0.014 + r(11) * 0.02,
    rateX2: 0.3 + r(12) * 0.4,
    rateY2: 0.26 + r(13) * 0.34,
    period: 2.4 + r(14) * 2.8,
    offset: r(15),
    // ~2-3Hz, i.e. 20-29 frames per beat at 60fps. Third pass at this number:
    // 9-12Hz read as frozen (55 deg of phase per frame, the eye integrates it
    // to a smear) and 4-6Hz still read as buzzing. A firefly really beats
    // ~50Hz and is genuinely invisible, so the true rate is never the right
    // rate — this is a stylised flap you can follow with your eye.
    // Radians/sec, so Hz = beat / 2pi.
    beat: 13 + r(16) * 6,
    beatLag: 0.35 + r(17) * 0.5,
    double: r(18) < 0.32,
  };
}

/**
 * One firefly: drifting flight, a flash envelope, and hinged wings.
 *
 * The body banks and turns to face where it's going — mirrored on the sign of
 * horizontal velocity, pitched by vertical velocity. That's the single biggest
 * difference between "a sprite being moved around" and "a thing flying", and it
 * costs two extra derivatives.
 */
export function Firefly({
  spec,
  clock,
  boxW,
  boxH,
  reduce,
  scatter,
}: {
  spec: FlySpec;
  clock: SharedValue<number>;
  boxW: number;
  boxH: number;
  reduce: boolean;
  scatter?: SharedValue<number>;
}) {
  const W = spec.size;
  const H = W / BODY_AR;

  const container = useAnimatedStyle(() => {
    'worklet';
    const t = clock.value;
    const dx = Math.sin(t / spec.rateX + spec.phaseX) * spec.ampX
             + Math.sin(t / spec.rateX2 + spec.phaseY) * spec.ampX2;
    const dy = Math.cos(t / spec.rateY + spec.phaseY) * spec.ampY
             + Math.cos(t / spec.rateY2 + spec.phaseX) * spec.ampY2;

    let x = (spec.homeX + dx) * boxW - W / 2;
    let y = (spec.homeY + dy) * boxH - H / 2;

    const s = scatter ? scatter.value : 0;
    if (s > 0) {
      const head = spec.phaseX + spec.phaseY;
      const spin = t * 2.4 + spec.offset * 6.28;
      const reach = s * Math.max(boxW, boxH) * 1.25;
      x += Math.cos(head) * reach + Math.cos(spin) * s * 46;
      y += Math.sin(head) * reach + Math.sin(spin) * s * 46;
    }
    return { transform: [{ translateX: x }, { translateY: y }], opacity: 1 - s * s };
  }, [boxW, boxH]);

  // Heading lives on its own layer. Two `transform` keys in one style array
  // silently discard one — the bug that flattened the wing mirror last time.
  const heading = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { transform: [{ scaleX: 1 }, { rotate: '0deg' }] };
    const t = clock.value;
    // Analytic derivatives — smoother and cheaper than differencing frames.
    //
    // Deliberately the PRIMARY harmonic only. The second harmonic is a small
    // fast wobble, but dividing by its short rate makes its velocity as large
    // as the drift's, so including it flipped the sprite every 1.3s and pinned
    // pitch to the clamp. Heading follows the course, not the jitter.
    const vx = Math.cos(t / spec.rateX + spec.phaseX) * (spec.ampX / spec.rateX);
    const vy = -Math.sin(t / spec.rateY + spec.phaseY) * (spec.ampY / spec.rateY);
    const dir = vx >= 0 ? 1 : -1;
    // Noses up on the climb, down on the dive. Scaled so a typical drift sits
    // well inside the clamp and only the steepest climb reaches it — an insect
    // tilts a little; pegged at the limit reads as tumbling.
    const pitch = Math.max(-16, Math.min(16, vy * 130)) * dir;
    return { transform: [{ scaleX: dir }, { rotate: `${pitch}deg` }] };
  }, [reduce]);

  // One envelope, read by both the glow and the body, so the lantern and the
  // lit-up body can never drift out of step.
  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.5, transform: [{ scale: 1 }] };
    const t = clock.value;
    const u = (((t / spec.period + spec.offset) % 1) + 1) % 1;
    const A = 0.035, D = 0.17;
    let l = 0;
    if (u < A) l = u / A;
    else if (u < A + D) l = Math.pow(1 - (u - A) / D, 1.9);
    else if (spec.double) {
      const u2 = u - (A + D + 0.06);
      if (u2 > 0 && u2 < 0.11) l = Math.pow(1 - u2 / 0.11, 1.6) * 0.55;
    }
    if (l > 0) l = Math.min(1, l * (1 + Math.sin(t * 31 + spec.offset * 9) * 0.08));
    return { opacity: l, transform: [{ scale: 0.5 + l * 0.8 }] };
  }, [reduce]);

  const bodyStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.9 };
    const t = clock.value;
    const u = (((t / spec.period + spec.offset) % 1) + 1) % 1;
    const A = 0.035, D = 0.17;
    let l = 0;
    if (u < A) l = u / A;
    else if (u < A + D) l = Math.pow(1 - (u - A) / D, 1.9);
    return { opacity: 0.62 + l * 0.38 };
  }, [reduce]);

  // Rotation, not scaleY: in side profile a wing hinges up and down, and
  // squashing it vertically reads as the wing shrinking rather than beating.
  //
  // Opacity tracks |sin| of the same phase, which is the part that actually
  // sells a wingbeat. A wing stops at the top and bottom of the stroke and is
  // fastest through the middle, so the eye catches it at the extremes and
  // smears it in between — a constant-opacity wing just looks like a flap of
  // cellophane waving.
  const wingNear = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { transform: [{ rotate: '-6deg' }], opacity: 0.46 };
    const s = Math.sin(clock.value * spec.beat);
    return {
      // ~86 degree arc, high over the back down to below level. The slower the
      // beat, the wider the sweep has to be or it reads as lazy waving.
      transform: [{ rotate: `${-8 + s * 43}deg` }],
      // Nearly flat now. The dwell-opacity trick fakes motion blur, which only
      // helps when the wing is too fast to see — at 2-3Hz you can see it, and
      // a deep swing just reads as flickering.
      opacity: 0.34 + Math.abs(s) * 0.14,
    };
  }, [reduce]);

  const wingFar = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { transform: [{ rotate: '-14deg' }], opacity: 0.24 };
    const s = Math.sin(clock.value * spec.beat + spec.beatLag);
    return {
      transform: [{ rotate: `${-17 + s * 38}deg` }],
      opacity: 0.2 + Math.abs(s) * 0.1,
    };
  }, [reduce]);

  const glowR = W * 1.5;
  const wingW = W * 0.66;
  const wingH = wingW / WING_AR;
  const hingeX = WING_HINGE.x * W;
  const hingeY = WING_HINGE.y * H;

  return (
    <Animated.View style={[styles.fly, { width: W, height: H }, container]} pointerEvents="none">
      <Animated.View style={[styles.fill, heading]}>
        <Animated.View
          style={[
            styles.abs,
            {
              width: glowR * 2,
              height: glowR * 2,
              left: LANTERN.x * W - glowR,
              top: LANTERN.y * H - glowR,
            },
            glowStyle,
          ]}
        >
          <Image source={GLOW} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>

        <Wing x={hingeX} y={hingeY - H * 0.09} w={wingW} h={wingH} style={wingFar} />

        <Animated.View style={[styles.fill, bodyStyle]}>
          <Image source={BODY} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>

        <Wing x={hingeX} y={hingeY} w={wingW} h={wingH} style={wingNear} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A wing that hinges at its root.
 *
 * The outer view is zero-sized and sits exactly on the hinge, so its transform
 * origin — the centre of a 0×0 box — IS the hinge. The image is then offset so
 * its own root lands there. Rotating the wing image directly would pivot around
 * the middle of the wing, which reads as spinning rather than flapping.
 *
 * The image is mirrored because the art has the blade sweeping up-RIGHT from
 * its root, which on a right-facing body points forward over the head.
 */
function Wing({
  x, y, w, h, style,
}: {
  x: number; y: number; w: number; h: number;
  style: { transform: unknown[]; opacity: number };
}) {
  return (
    <Animated.View style={[styles.hinge, { left: x, top: y }, style as never]}>
      <View
        style={{
          position: 'absolute',
          left: -w * WING_ROOT.x,
          top: -h * WING_ROOT.y,
          width: w,
          height: h,
          transform: [{ scaleX: -1 }],
        }}
      >
        <Image source={WING} style={styles.fill} contentFit="contain" transition={0} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fly: { position: 'absolute', left: 0, top: 0 },
  abs: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  hinge: { position: 'absolute', width: 0, height: 0 },
});
