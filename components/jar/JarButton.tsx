import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { POUCH_COST } from '@/components/curio/curios';

const ICON = require('@/assets/jar/jar-icon.webp');

interface Props {
  balance: number;
  /** Fireflies banked since the reader last opened the jar. Drives the shake. */
  unseen: number;
  onPress: () => void;
}

/**
 * The jar, in the Home header.
 *
 * Two states, and they mean different things on purpose:
 *
 *   unseen > 0  — something arrived. A short shake every few seconds, which
 *                 stops for good once the jar has been opened.
 *   full        — the jar is at a pouch. A slow ambient glow that never stops,
 *                 because this is a standing invitation rather than news.
 *
 * A jar that shakes forever is nagging; one that glows forever is just warm.
 */
export function JarButton({ balance, unseen, onPress }: Props) {
  const reduce = useReducedMotion();
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);
  const press = useSharedValue(0);

  const full = balance >= POUCH_COST;
  const hasNew = unseen > 0;

  useEffect(() => {
    if (reduce || !hasNew) {
      shake.value = 0;
      return;
    }
    // A quick wobble, then a long pause — repeated. The pause is what keeps it
    // from reading as a broken animation loop.
    shake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
        withTiming(-1, { duration: 110 }),
        withTiming(0.7, { duration: 100 }),
        withTiming(-0.4, { duration: 90 }),
        withTiming(0, { duration: 80 }),
        withDelay(3400, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [hasNew, reduce, shake]);

  useEffect(() => {
    if (reduce || !full) {
      glow.value = withTiming(0, { duration: 260 });
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 1300, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [full, reduce, glow]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${shake.value * 9}deg` },
      { scale: (1 + shake.value * 0.04) * (1 - press.value * 0.1) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.85,
    transform: [{ scale: 0.9 + glow.value * 0.25 }],
  }));

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        if (!reduce) press.value = withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        if (!reduce) press.value = withTiming(0, { duration: 130 });
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        full
          ? `Your jar is full, ${balance} fireflies`
          : hasNew
          ? `Your jar, ${balance} fireflies, ${unseen} new`
          : `Your jar, ${balance} fireflies`
      }
      style={styles.wrap}
    >
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
      <Animated.View style={iconStyle}>
        <Image source={ICON} style={styles.icon} contentFit="contain" transition={0} />
      </Animated.View>
      {hasNew ? <View style={styles.dot} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 30, height: 41 },
  glow: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFD86B',
    shadowColor: '#FFC94A',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0,
  },
  // A dot, not a count. The number is one tap away and a badge of "37" on a jar
  // invites reading it as a task list rather than a nice surprise.
  dot: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F0764F',
    borderWidth: 1.5,
    borderColor: '#FCF8ED',
  },
});
