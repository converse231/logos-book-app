import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { CURIOS, DUPLICATE_REFUND, type CurioKey } from '@/components/curio/curios';
import type { PouchResult } from '@/services/types';

// What you get for a pouch.
//
// An overlay rather than a route: the spend and the reveal are one moment, and
// pushing a modal between them would let the balance update land on a screen
// you are no longer looking at.
//
// Backdrop is a dark translucent scrim, never a blur — house rule.
export function PouchReveal({
  result,
  onDone,
}: {
  result: PouchResult;
  onDone: () => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();

  const pop = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      pop.value = 1;
      glow.value = 1;
      return;
    }
    // Overshoot, then settle — the curio is tipped out of the pouch, not faded in.
    pop.value = withSequence(
      withTiming(0, { duration: 90 }),
      withSpring(1, { damping: 9, stiffness: 150, mass: 0.7 })
    );
    glow.value = withDelay(120, withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) }));
  }, [reduce, pop, glow, result]);

  const artStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.55 + pop.value * 0.45 }, { rotate: `${(1 - pop.value) * -14}deg` }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.5,
    transform: [{ scale: 0.7 + glow.value * 0.5 }],
  }));

  if (!result.ok) {
    return (
      <Pressable style={styles.scrim} onPress={onDone} accessibilityRole="button">
        <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Not enough yet</Text>
          <Text style={[styles.blurb, { color: t.textSec }]}>
            {`A pouch costs ${result.cost} fireflies. Read a little more.`}
          </Text>
          <Text style={[styles.tap, { color: t.textTer }]}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    );
  }

  const def = CURIOS[result.key as CurioKey];
  // A key the server rolled but this build cannot draw — only possible if the
  // RPC's list gained an entry that components/curio/curios.ts did not.
  if (!def) {
    return (
      <Pressable style={styles.scrim} onPress={onDone} accessibilityRole="button">
        <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Something new</Text>
          <Text style={[styles.blurb, { color: t.textSec }]}>
            It is on your shelf. Update the app to see it properly.
          </Text>
          <Text style={[styles.tap, { color: t.textTer }]}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDone}
      accessibilityRole="button"
      accessibilityLabel={
        result.duplicate
          ? `Another ${def.name}. ${result.refunded} fireflies back. Tap to close.`
          : `You found a ${def.name}. ${def.blurb} Tap to close.`
      }
    >
      <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
        <Text style={[styles.kicker, { color: result.duplicate ? t.textTer : t.gold }]}>
          {result.duplicate ? 'ANOTHER ONE' : 'NEW FIND'}
        </Text>

        <View style={styles.artWrap}>
          {!result.duplicate ? (
            <Animated.View
              style={[styles.halo, { backgroundColor: t.gold }, haloStyle]}
              pointerEvents="none"
            />
          ) : null}
          <Animated.View style={[styles.art, artStyle]}>
            <Image source={def.art} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
          </Animated.View>
        </View>

        <Text style={[styles.title, { color: t.text }]}>{def.name}</Text>
        <Text style={[styles.blurb, { color: t.textSec }]}>
          {result.duplicate
            ? `You had one already — ${DUPLICATE_REFUND} fireflies back. That makes ${result.count}.`
            : def.blurb}
        </Text>

        <Text style={[styles.tap, { color: t.textTer }]}>TAP TO CLOSE</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,4,6,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 24, borderWidth: 2,
    padding: 24, alignItems: 'center', gap: 8,
  },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 2.6 },
  artWrap: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  // A soft disc behind a new find. RN cannot draw a radial gradient on a View,
  // so this is a plain circle at low opacity — read as a wash, not a ring.
  halo: { position: 'absolute', width: 168, height: 168, borderRadius: 84 },
  art: { width: 148, height: 148 },
  title: { fontFamily: FONTS.serifBold, fontSize: 24, textAlign: 'center' },
  blurb: { fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  tap: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 2, marginTop: 10 },
});
