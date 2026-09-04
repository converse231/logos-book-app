import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, G, Polygon, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import {
  CURIOS,
  DUPLICATE_REFUND,
  curioTier,
  type CurioKey,
} from '@/components/curio/curios';
import type { PouchResult } from '@/services/types';

const POUCH = require('@/assets/curio/pouch.webp');

// Opening a pouch.
//
// An overlay rather than a route: the spend and the reveal are one moment, and
// pushing a modal between them would let the balance update land on a screen
// nobody is looking at.
//
// The choreography is anticipation → break → reveal → read, in that order,
// because the eye needs to be told something is coming before it arrives. Every
// beat is a delayed spring or timing off one mount effect, so the whole sequence
// is declared in one place and reads top to bottom.
const T = {
  scrim: 0,
  pouch: 60,
  shake: 500,
  flash: 1680,
  vanish: 1685,
  item: 1760,
  burst: 1760,
  motes: 1770,
  name: 2080,
  blurb: 2220,
  hint: 2360,
  /** When a tap starts meaning "close" instead of "skip ahead". */
  settled: 2240,
};
/** The wind-up, stretched from 780ms. This is what "too quick" actually was:
 *  the reveal already landed late enough, but 780ms is not long enough for
 *  anticipation to register before the payoff arrives. */
const SHAKE_MS = 1180;

const RAYS = 12;
const MOTES = 34;
/** Half-width of a spoke, in radians at the rim. At 0.052 (a 6 degree spoke)
 *  twelve rays did not resolve as rays — the whole burst read as one turning
 *  disc. 0.085 is a ~10 degree spoke. */
const RAY_W = 0.085;

export function PouchReveal({ result, onDone }: { result: PouchResult; onDone: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();

  // Every hook runs before any branch below. Putting a `return` above a hook is
  // what caused the "rendered fewer hooks than expected" crash on the
  // session-complete screen, so all of them live up here unconditionally.
  const scrim = useSharedValue(0);
  const drop = useSharedValue(0);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const vanish = useSharedValue(0);
  const item = useSharedValue(0);
  const burst = useSharedValue(0);
  const spin = useSharedValue(0);
  const spin2 = useSharedValue(0);
  const motes = useSharedValue(0);
  const name = useSharedValue(0);
  const blurb = useSharedValue(0);
  const hint = useSharedValue(0);

  const [settled, setSettled] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const ok = result.ok;
  const isNew = result.ok && !result.duplicate;
  // A duplicate that crosses a tier threshold is a promotion, not a
  // consolation, so it gets the loud treatment: rays, gold, success haptic.
  const tierUp =
    result.ok &&
    result.duplicate &&
    curioTier(result.count).index > curioTier(result.count - 1).index;
  const loud = isNew || tierUp;

  useEffect(() => {
    // The refusal state has nothing to reveal, so it just appears.
    if (!ok || reduce) {
      scrim.value = 1;
      drop.value = 1;
      item.value = 1;
      burst.value = 1;
      name.value = 1;
      blurb.value = 1;
      hint.value = 1;
      vanish.value = ok ? 1 : 0;
      setSettled(true);
      return;
    }

    scrim.value = withTiming(1, { duration: 240 });
    // Lands with weight: overshoot, then a squash resolved in the style below.
    drop.value = withDelay(T.pouch, withSpring(1, { damping: 12, stiffness: 140, mass: 0.9 }));
    shake.value = withDelay(T.shake, withTiming(1, { duration: SHAKE_MS, easing: Easing.linear }));
    flash.value = withDelay(
      T.flash,
      withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) })
      )
    );
    vanish.value = withDelay(T.vanish, withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }));
    item.value = withDelay(T.item, withSpring(1, { damping: 9, stiffness: 150, mass: 0.8 }));
    burst.value = withDelay(T.burst, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    // Slow, continuous — a still starburst reads as a decal, a turning one reads
    // as light.
    spin.value = withDelay(
      T.burst,
      withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false)
    );
    // The inner ring turns the OTHER way, and slower. One ring alone reads as a
    // rigid wheel; two speeds in opposition read as light.
    spin2.value = withDelay(
      T.burst,
      withRepeat(withTiming(1, { duration: 34000, easing: Easing.linear }), -1, false)
    );
    motes.value = withDelay(T.motes, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    name.value = withDelay(T.name, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    blurb.value = withDelay(T.blurb, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    hint.value = withDelay(T.hint, withTiming(1, { duration: 380 }));

    // Haptics ride the same beats: three rising taps through the shake, then the
    // payoff. A duplicate gets a flatter thud instead of the success pattern.
    const tap = (at: number, fn: () => void) => timers.current.push(setTimeout(fn, at));
    tap(T.shake + 180, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    tap(T.shake + 580, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    tap(T.shake + 940, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    tap(T.flash, () =>
      loud
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    );
    tap(T.settled, () => setSettled(true));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [ok, loud, reduce, scrim, drop, shake, flash, vanish, item, burst, spin, spin2, motes, name, blurb, hint]);

  /** Tapping mid-sequence jumps to the end rather than throwing the reward away. */
  const skip = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    scrim.value = 1;
    drop.value = 1;
    shake.value = 1;
    flash.value = 0;
    vanish.value = 1;
    item.value = withSpring(1, { damping: 12, stiffness: 220 });
    burst.value = withTiming(1, { duration: 160 });
    motes.value = 1;
    name.value = withTiming(1, { duration: 160 });
    blurb.value = withTiming(1, { duration: 160 });
    hint.value = withTiming(1, { duration: 160 });
    setSettled(true);
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const pouchStyle = useAnimatedStyle(() => {
    // Build: ~7 cycles across the window, amplitude ramping so it winds up
    // rather than rattling at full tilt from the first frame.
    const s = shake.value;
    const swing = Math.sin(s * Math.PI * 11) * Math.pow(s, 1.5);
    const land = drop.value;
    return {
      opacity: 1 - vanish.value,
      transform: [
        { translateY: (1 - land) * -150 + swing * 3 },
        { rotate: `${swing * 9}deg` },
        // Squash on landing, then a slow swell through the wind-up, then the pop
        // as it breaks.
        { scaleX: (1 + (1 - land) * 0.18) * (1 + s * 0.06) * (1 + vanish.value * 0.35) },
        { scaleY: (1 - (1 - land) * 0.14) * (1 + s * 0.06) * (1 + vanish.value * 0.35) },
      ],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.92 }));

  const itemStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, item.value * 2),
    transform: [{ scale: 0.25 + item.value * 0.75 }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value * (loud ? 1 : 0.5),
    transform: [{ scale: 0.55 + burst.value * 0.45 }, { rotate: `${spin.value * 360}deg` }],
  }));

  const burstInnerStyle = useAnimatedStyle(() => ({
    opacity: burst.value * (loud ? 0.9 : 0.4),
    transform: [{ scale: 0.4 + burst.value * 0.44 }, { rotate: `${-spin2.value * 360}deg` }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.value,
    transform: [{ translateY: (1 - name.value) * 12 }],
  }));
  const blurbStyle = useAnimatedStyle(() => ({
    opacity: blurb.value,
    transform: [{ translateY: (1 - blurb.value) * 10 }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value * 0.8 }));
  // The refund floats up and fades, so the number is read as arriving.
  const refundStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, motes.value * 3) * (1 - Math.max(0, motes.value - 0.6) / 0.4),
    transform: [{ translateY: -motes.value * 46 }],
  }));

  // ── branches: no hooks past this line ─────────────────────────────────────
  if (!result.ok) {
    return (
      <Pressable style={styles.scrimStatic} onPress={onDone} accessibilityRole="button">
        <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>
            {result.reason === 'error' ? 'That did not go through' : 'Not enough yet'}
          </Text>
          <Text style={[styles.blurb, { color: t.textSec }]}>
            {result.reason === 'error'
              ? 'Nothing was spent — your fireflies are all still there. Try again in a moment.'
              : `A pouch costs ${result.cost} fireflies. Read a little more.`}
          </Text>
          <Text style={[styles.hint, { color: t.textTer }]}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    );
  }

  const def = CURIOS[result.key as CurioKey];
  if (!def) {
    // The server rolled a key this build cannot draw — only possible if the
    // RPC's list gained an entry that curios.ts did not.
    return (
      <Pressable style={styles.scrimStatic} onPress={onDone} accessibilityRole="button">
        <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Something new</Text>
          <Text style={[styles.blurb, { color: t.textSec }]}>
            It is on your shelf. Update the app to see it properly.
          </Text>
          <Text style={[styles.hint, { color: t.textTer }]}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    );
  }

  const tint = loud ? '#F3C24C' : '#9AA7B4';

  return (
    <Animated.View style={[styles.scrimAnim, scrimStyle]}>
      <Pressable
        style={styles.sheet}
        onPress={settled ? onDone : skip}
        accessibilityRole="button"
        accessibilityLabel={
          result.duplicate
            ? `Another ${def.name}. ${result.refunded} fireflies back. Tap to close.`
            : `You found a ${def.name}. ${def.blurb} Tap to close.`
        }
      >
        <View style={styles.stage}>
          {/* Burst sits behind everything on the stage. */}
          <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
            <Burst tint={tint} rays={loud} />
          </Animated.View>
          {/* Offset half a spoke so the short rays sit BETWEEN the long ones. */}
          <Animated.View style={[styles.burstInner, burstInnerStyle]} pointerEvents="none">
            <Burst tint={tint} rays={loud} inner />
          </Animated.View>

          <Animated.View style={[styles.slot, itemStyle]} pointerEvents="none">
            <Image source={def.art} style={styles.fill} contentFit="contain" transition={0} />
          </Animated.View>

          {/* Drawn after the curio so the pouch is in front while it still
              exists; it has vanished by the time the curio appears. */}
          <Animated.View style={[styles.slot, pouchStyle]} pointerEvents="none">
            <Image source={POUCH} style={styles.fill} contentFit="contain" transition={0} />
          </Animated.View>

          <Motes progress={motes} tint={tint} />

          {result.duplicate ? (
            <Animated.View style={[styles.refund, refundStyle]} pointerEvents="none">
              <Text style={styles.refundText}>{`+${DUPLICATE_REFUND}`}</Text>
            </Animated.View>
          ) : null}

          {/* A full-stage white wash at the moment the pouch gives. */}
          <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />
        </View>

        <Animated.View style={nameStyle}>
          <Text style={[styles.kicker, { color: loud ? '#F3C24C' : 'rgba(247,239,224,0.6)' }]}>
            {isNew
              ? 'NEW FIND'
              : tierUp
              ? (curioTier(result.count).name ?? '').toUpperCase()
              : 'ANOTHER ONE'}
          </Text>
          <Text style={styles.name}>{def.name}</Text>
        </Animated.View>

        <Animated.View style={blurbStyle}>
          <Text style={styles.blurbLight}>{revealCopy(result, def.blurb)}</Text>
        </Animated.View>

        <Animated.View style={hintStyle}>
          <Text style={styles.hintLight}>TAP TO CLOSE</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * What the reveal says.
 *
 * A duplicate is framed three different ways depending on what it did: promoted
 * this curio a tier, moved it closer to one, or topped it out. "You had one
 * already" is only right the first few times — past completion every pouch is a
 * duplicate, and that framing would turn the whole late game into an apology.
 */
function revealCopy(result: Extract<PouchResult, { ok: true }>, blurb: string) {
  if (!result.duplicate) return blurb;
  const now = curioTier(result.count);
  const before = curioTier(result.count - 1);
  if (now.index > before.index) {
    return `Copy ${result.count}. This one is ${(now.name ?? '').toLowerCase()} now — and ${DUPLICATE_REFUND} fireflies back.`;
  }
  if (now.toNext === null) {
    return `Copy ${result.count}. Nothing left to reach on this one. ${DUPLICATE_REFUND} fireflies back.`;
  }
  return `Copy ${result.count} — ${now.toNext} more to ${(now.nextName ?? '').toLowerCase()}. ${DUPLICATE_REFUND} fireflies back.`;
}

/**
 * The light behind a find.
 *
 * SVG rather than Views because a View cannot have a soft radial falloff — the
 * halo needs a real gradient, and the rays need to fade out toward their tips or
 * they read as a paper windmill. Both fills are radial gradients centred on the
 * burst, which is what tapers each ray along its own length.
 */
function Burst({ tint, rays, inner }: { tint: string; rays: boolean; inner?: boolean }) {
  const spokes = [];
  if (rays) {
    for (let i = 0; i < RAYS; i++) {
      // The inner ring is rotated half a step so its spokes fall in the gaps.
      const a = ((i + (inner ? 0.5 : 0)) / RAYS) * Math.PI * 2;
      const w = inner ? RAY_W * 0.62 : RAY_W;
      const p1 = [50 + 49 * Math.cos(a - w), 50 + 49 * Math.sin(a - w)];
      const p2 = [50 + 49 * Math.cos(a + w), 50 + 49 * Math.sin(a + w)];
      // Alternating length, so it reads as light rather than a gear.
      const k = (i % 2 ? 0.66 : 1) * (inner ? 0.8 : 1);
      spokes.push(
        <Polygon
          key={i}
          points={`50,50 ${50 + (p1[0] - 50) * k},${50 + (p1[1] - 50) * k} ${
            50 + (p2[0] - 50) * k
          },${50 + (p2[1] - 50) * k}`}
          fill="url(#rayFade)"
        />
      );
    }
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={tint} stopOpacity="0.5" />
          <Stop offset="0.45" stopColor={tint} stopOpacity="0.16" />
          <Stop offset="1" stopColor={tint} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF4D2" stopOpacity="0.5" />
          <Stop offset="0.5" stopColor="#FFF4D2" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#FFF4D2" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#halo)" />
      <G>{spokes}</G>
    </Svg>
  );
}

/**
 * Sparks thrown out when the pouch gives.
 *
 * Deterministic angles and distances, so a re-render never reshuffles them
 * mid-flight. They decelerate and fade rather than travelling at constant speed,
 * which is the difference between debris and a burst.
 */
function Motes({ progress, tint }: { progress: SharedValue<number>; tint: string }) {
  return (
    <View style={styles.moteLayer} pointerEvents="none">
      {Array.from({ length: MOTES }, (_, i) => (
        <Mote key={i} i={i} progress={progress} tint={tint} />
      ))}
    </View>
  );
}

function Mote({
  i,
  progress,
  tint,
}: {
  i: number;
  progress: SharedValue<number>;
  tint: string;
}) {
  const h = (n: number) => {
    const s = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  // Two rings at different radii. With every spark on one circle the burst
  // reads as a ring expanding rather than as a spray.
  const ring = i % 2;
  const angle = (i / MOTES) * Math.PI * 2 + h(1) * 0.5;
  const dist = (ring ? 58 : 98) + h(2) * 62;
  const size = 2.5 + h(3) * 5;
  const lag = h(4) * 0.22;

  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.value - lag) / (1 - lag)));
    return {
      opacity: p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88,
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        { translateY: Math.sin(angle) * dist * p - p * p * 12 },
        { scale: 1 - p * 0.45 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.mote,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
        style,
      ]}
    />
  );
}

const INK = '#F7EFE0';

const styles = StyleSheet.create({
  // Scrim, never a blur — house rule.
  scrimAnim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3,4,6,0.72)',
  },
  scrimStatic: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3,4,6,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  fill: { ...StyleSheet.absoluteFill },
  sheet: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stage: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: 300, height: 300 },
  burstInner: { position: 'absolute', width: 198, height: 198 },
  // ABSOLUTE, or the pouch and the curio become flex siblings and stack
  // vertically — 304px of children in a 260px stage, which is why the revealed
  // item sat above centre with the pouch shoved below it. They have to occupy
  // the same square.
  slot: { position: 'absolute', width: 152, height: 152 },
  moteLayer: { position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  mote: { position: 'absolute' },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: '#FFF6E2', borderRadius: 130 },
  refund: { position: 'absolute', bottom: 34 },
  refundText: {
    fontFamily: FONTS.monoBold, fontSize: 22, color: '#F3C24C',
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  kicker: {
    fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 2.6, textAlign: 'center',
  },
  name: {
    fontFamily: FONTS.serifBold, fontSize: 28, lineHeight: 34,
    color: INK, textAlign: 'center', marginTop: 4,
  },
  blurbLight: {
    fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21,
    color: 'rgba(247,239,224,0.86)', textAlign: 'center',
    paddingHorizontal: 34, marginTop: 8, maxWidth: 360,
  },
  hintLight: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 2,
    color: 'rgba(247,239,224,0.72)', textAlign: 'center', marginTop: 26,
  },
  // the refusal / unknown-key cards keep the plain themed look
  card: {
    width: '100%', maxWidth: 340, borderRadius: 24, borderWidth: 2,
    padding: 24, alignItems: 'center', gap: 8,
  },
  title: { fontFamily: FONTS.serifBold, fontSize: 24, textAlign: 'center' },
  blurb: { fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  hint: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 2, marginTop: 10 },
});
