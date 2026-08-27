import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';

const BODY = require('@/assets/jar/fly-body.webp');
const WING = require('@/assets/jar/fly-wing.webp');
const GLOW = require('@/assets/jar/glow.webp');

/** Top-down (dorsal) view, facing UP. All anchors measured off the art. The
 *  body sprite is the insect with its baked-in wings stripped away, so the two
 *  animated wings below are the only ones on screen. */
const BODY_AR = 140 / 398;
const WING_AR = 100 / 247;
/** Glowing abdomen centroid, as a fraction of the body sprite. */
const LANTERN = { x: 0.485, y: 0.764 };
/** Left shoulder, on the elytra just above where the baked wings emerged. The
 *  right wing mirrors this across the midline. */
const HINGE = { x: 0.2, y: 0.32 };
/** The wing's narrow root — bottom-right of the sprite, blade running up-left
 *  on a measured -108 degree axis. */
const WING_ROOT = { x: 0.886, y: 0.996 };
/** Rest angle putting a left wing swept back over the abdomen (-108 + -117
 *  lands the blade at 135 deg), and the fore-aft sweep either side of it. */
const WING_BASE = 117;
/** Floor under the flash envelope, so an unlit fly still carries a faint lantern. */
const REST_GLOW = 0.18;
const WING_AMP = 35;

export interface FlySpec {
  /** Sprite HEIGHT — dorsal, the body is ~1:2.8, so height is the honest one. */
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

/**
 * Deterministic from the index — the same jar draws the same every render.
 *
 * `count` and the box size are required, not optional extras: the placement grid
 * needs the count, and the usable band needs the box so each fly's own size can
 * set its margin.
 */
export function flySpec(
  i: number,
  count: number,
  boxW: number,
  boxH: number,
  seed = 0
): FlySpec {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * 12.9898 + n * 78.233 + seed * 3.71) * 43758.5453;
    return s - Math.floor(s);
  };
  const size = 26 + r(1) * 14;
  // Half the diagonal the sprite sweeps as it rotates, per axis. This is the
  // margin the fly cannot cross without the interior's overflow:hidden
  // clipping it.
  const reach = (size * 1.06) / 2;
  const mx = reach / Math.max(1, boxW);
  const my = reach / Math.max(1, boxH);

  const ampX = 0.045 + r(4) * 0.04;
  const ampY = 0.038 + r(5) * 0.034;
  const ampX2 = 0.012 + r(10) * 0.016;
  const ampY2 = 0.01 + r(11) * 0.014;

  // One fly per cell of a grid shaped to the box, jittered inside its cell so
  // the arrangement never reads as a lattice. This is what fixes the crowding:
  // a hash over a fixed band piles flies into the middle at low counts, while a
  // grid covers the jar evenly at any count.
  const cols = Math.max(1, Math.ceil(Math.sqrt((count * boxW) / Math.max(1, boxH))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const padX = mx + ampX + ampX2;
  const padY = my + ampY + ampY2;
  const spanX = Math.max(0.02, 1 - 2 * padX);
  const spanY = Math.max(0.02, 1 - 2 * padY);

  return {
    size,
    homeX: padX + spanX * (((i % cols) + 0.2 + r(2) * 0.6) / cols),
    homeY: padY + spanY * ((Math.floor(i / cols) + 0.2 + r(3) * 0.6) / rows),
    ampX,
    ampY,
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
    ampX2,
    ampY2,
    rateX2: 0.3 + r(12) * 0.4,
    rateY2: 0.26 + r(13) * 0.34,
    period: 2.4 + r(14) * 2.8,
    offset: r(15),
    // ~5.1-6.7Hz, i.e. 9-12 frames per beat at 60fps.
    //
    // History worth keeping: an early comment here claimed 9-12Hz "read as
    // frozen". That was measured while the rotation was silently not applying
    // at all (the 0x0 pivot bug), so it was never a real finding about rate.
    // The ceiling that does matter is frames-per-beat, not Hz — below about 6
    // the stroke starts to look stepped rather than fast, which caps this
    // around 10Hz on a 60fps display. A firefly really beats ~50Hz and is
    // genuinely invisible, so the true rate is never the right rate.
    // Radians/sec, so Hz = beat / 2pi.
    // ~7.6-9.9Hz. Real fireflies beat far faster than this, but past ~15Hz a
    // 60fps sprite starts to alias into a flicker instead of reading as a beat,
    // so this is the fastest that still looks like flight.
    beat: 48 + r(16) * 14,
    beatLag: 0.35 + r(17) * 0.5,
    double: r(18) < 0.32,
  };
}

/**
 * One firefly: drifting flight, a flash envelope, and two hinged wings.
 *
 * The body turns to face where it's going, straight from atan2 of its own
 * velocity. That's the single biggest difference between "a sprite being moved
 * around" and "a thing flying", and dorsal view is what makes it exact.
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
  const H = spec.size;
  const W = H * BODY_AR;
  const wingH = H * 0.6;
  const wingW = wingH * WING_AR;

  // Offset from each wing view's centre to the root it hinges on. Mirroring the
  // image moves the root to 1 - WING_ROOT.x, so the right wing's pivot follows.
  // Plain numbers, resolved on the JS side — calling a helper from inside a
  // worklet needs it to be a worklet too, and this needs no helper.
  const pdxL = (WING_ROOT.x - 0.5) * wingW;
  const pdxR = (0.5 - WING_ROOT.x) * wingW;
  const pdy = (WING_ROOT.y - 0.5) * wingH;

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

  // Heading on its own layer — two `transform` keys in one style array
  // silently discard one.
  //
  // This is what dorsal view buys: the fly rotates to face its own velocity, so
  // it points exactly where it is going. The side profile could only fake this
  // with a left/right mirror plus a clamped pitch.
  const heading = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { transform: [{ rotate: '0deg' }] };
    const t = clock.value;
    // Primary harmonic only — the second harmonic's velocity is as large as the
    // drift's once divided by its short rate, which makes the fly twitch
    // rather than turn.
    const vx = Math.cos(t / spec.rateX + spec.phaseX) * (spec.ampX / spec.rateX);
    const vy = -Math.sin(t / spec.rateY + spec.phaseY) * (spec.ampY / spec.rateY);
    // Sprite points UP (-y), so +90 converts "angle from +x" to sprite facing.
    // Assigned directly each frame, never animated, so the atan2 wrap at +-180
    // costs nothing.
    return { transform: [{ rotate: `${(Math.atan2(vy, vx) * 180) / Math.PI + 90}deg` }] };
  }, [reduce]);

  // One envelope, read by both the glow and the body, so the lantern and the
  // lit-up body can never drift out of step.
  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduce) return { opacity: 0.5, transform: [{ scale: 1 }] };
    const t = clock.value;
    const u = (((t / spec.period + spec.offset) % 1) + 1) % 1;
    const A = 0.035, D = 0.2;
    let l = 0;
    if (u < A) l = u / A;
    else if (u < A + D) l = Math.pow(1 - (u - A) / D, 1.9);
    else if (spec.double) {
      const u2 = u - (A + D + 0.06);
      if (u2 > 0 && u2 < 0.11) l = Math.pow(1 - u2 / 0.11, 1.6) * 0.55;
    }
    if (l > 0) l = Math.min(1, l * (1 + Math.sin(t * 31 + spec.offset * 9) * 0.08));
    // A resting ember under the flash. The envelope is only lit for ~a fifth of
    // its period, so without a floor most of the jar is dark most of the time —
    // which read as a dim jar rather than as fireflies pulsing in one.
    l = Math.max(REST_GLOW, l);
    return { opacity: l, transform: [{ scale: 0.45 + l * 1.05 }] };
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

  // Dorsal wings sweep fore-and-aft in the image plane, which is pure rotation
  // about the shoulder — the one wing motion a flat sprite can do honestly.
  //
  // Each returns a FULL transform list, not a bare rotate: RN rotates about a
  // view's centre, so the rotation is sandwiched between translations that move
  // the pivot to the wing root and back. The previous version parked a 0x0 View
  // on the hinge and rotated that, which silently never applied — the wings sat
  // frozen at their untransformed angle, splayed forward past the head.
  const wingLeft = useAnimatedStyle(() => {
    'worklet';
    const s = reduce ? 0 : Math.sin(clock.value * spec.beat);
    return {
      transform: [
        { translateX: pdxL }, { translateY: pdy },
        { rotate: `${-WING_BASE + s * WING_AMP}deg` },
        { translateX: -pdxL }, { translateY: -pdy },
      ],
      opacity: 0.8 + Math.abs(s) * 0.14,
    };
  }, [reduce, pdxL, pdxR, pdy]);

  const wingRight = useAnimatedStyle(() => {
    'worklet';
    // Very nearly in phase with the left — a real insect beats both together,
    // and the tiny lag only stops them reading as mechanically identical.
    const s = reduce ? 0 : Math.sin(clock.value * spec.beat + spec.beatLag * 0.15);
    return {
      transform: [
        { translateX: pdxR }, { translateY: pdy },
        { rotate: `${WING_BASE - s * WING_AMP}deg` },
        { translateX: -pdxR }, { translateY: -pdy },
      ],
      opacity: 0.8 + Math.abs(s) * 0.14,
    };
  }, [reduce, pdxL, pdxR, pdy]);

  // The glow sprite already peaks at full opacity, so a brighter flash has to
  // come from reach and bloom rather than more alpha.
  const glowR = H * 0.88;

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

        {/* Wings under the body: they emerge from beneath the elytra, so the
            body has to cover their roots. */}
        <Wing hx={HINGE.x * W} hy={HINGE.y * H} w={wingW} h={wingH} style={wingLeft} />
        <Wing hx={(1 - HINGE.x) * W} hy={HINGE.y * H} w={wingW} h={wingH} mirror style={wingRight} />

        <Animated.View style={[styles.fill, bodyStyle]}>
          <Image source={BODY} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A wing, sized normally and placed so its root sits on the hinge.
 *
 * The rotation pivot is handled in the animated transform (see `pivot`) rather
 * than by nesting inside a zero-sized View — that trick relies on RN applying a
 * transform to a 0x0 frame, which it does not do, so the wings never moved.
 */
function Wing({
  hx, hy, w, h, mirror, style,
}: {
  hx: number; hy: number; w: number; h: number; mirror?: boolean;
  style: { transform: unknown[]; opacity: number };
}) {
  const rootX = mirror ? 1 - WING_ROOT.x : WING_ROOT.x;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: hx - w * rootX, top: hy - h * WING_ROOT.y, width: w, height: h },
        style as never,
      ]}
    >
      <Image
        source={WING}
        style={[styles.fill, mirror ? styles.flip : null]}
        contentFit="contain"
        transition={0}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fly: { position: 'absolute', left: 0, top: 0 },
  abs: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  flip: { transform: [{ scaleX: -1 }] },
});
