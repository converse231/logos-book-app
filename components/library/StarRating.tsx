import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE } from '@/theme/tokens';

interface StarRatingProps {
  value: number;
  /** When provided the stars become tappable. Omit for display-only. */
  onChange?: (rating: number) => void;
  /** Half-star precision: the LEFT half of a star scores x.5, the right half x. */
  allowHalf?: boolean;
  size?: number;
  color?: string;
}

/** Stars fire left-to-right this many ms apart. */
const STAGGER = 45;
const PIPS = 8;

// Display + input star rating. Stars are graphical, so they use the bright
// marigold gold on every substrate (the theme's text-gold is intentionally dull
// for contrast). Interactive half-star mode lays two transparent touch zones over
// each star (left = ½, right = full) — far more reliable than reading locationX.
//
// Rating is the one moment on this screen worth celebrating, so a tap sweeps the
// lit stars left-to-right and throws a small radial burst from the star you hit.
// The sweep is what makes the row read as a VALUE filling up rather than a strip
// of lights switching on — which is why it's staggered rather than simultaneous.
//
// All of it is driven off a tap nonce, never off `value`, so a rating arriving
// from the server on mount lands silently.
export function StarRating({ value, onChange, allowHalf = false, size = 18, color }: StarRatingProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const gold = color ?? PALETTE.gold;
  const interactive = typeof onChange === 'function';
  // n: bumped per tap so the children animate. star: which one bursts.
  const [tap, setTap] = useState({ n: 0, star: 0 });

  const glyphFor = (i: number) => {
    const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
    const lit = value >= i - 0.5;
    return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={lit ? gold : t.textTer} />;
  };

  const pick = (r: number) => {
    Haptics.selectionAsync();
    setTap((p) => ({ n: p.n + 1, star: Math.ceil(r) }));
    onChange!(r);
  };

  return (
    <View style={[styles.row, { gap: size * 0.18 }]} accessibilityLabel={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (!interactive) return <View key={i}>{glyphFor(i)}</View>;
        return (
          <Star
            key={i}
            index={i}
            size={size}
            gold={gold}
            reduce={reduce}
            nonce={tap.n}
            lit={value >= i - 0.5}
            burst={tap.star === i}
          >
            {glyphFor(i)}
            {allowHalf ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${i - 0.5} stars`}
                  onPress={() => pick(i - 0.5)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[StyleSheet.absoluteFill, { right: size / 2 }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${i} stars`}
                  onPress={() => pick(i)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[StyleSheet.absoluteFill, { left: size / 2 }]}
                />
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rate ${i} star${i > 1 ? 's' : ''}`}
                onPress={() => pick(i)}
                hitSlop={6}
                style={StyleSheet.absoluteFill}
              />
            )}
          </Star>
        );
      })}
    </View>
  );
}

/** One tappable star: the sweep pop, plus the burst if it was the one hit. */
function Star({
  index,
  size,
  gold,
  reduce,
  nonce,
  lit,
  burst,
  children,
}: {
  index: number;
  size: number;
  gold: string;
  reduce: boolean;
  nonce: number;
  lit: boolean;
  burst: boolean;
  children: React.ReactNode;
}) {
  const pop = useSharedValue(1);
  const fly = useSharedValue(0);

  useEffect(() => {
    if (nonce === 0 || reduce) return;
    // Only stars that ended up lit take part in the sweep — the ones going dark
    // shouldn't celebrate being turned off.
    if (lit) {
      pop.value = withDelay(
        (index - 1) * STAGGER,
        withSequence(
          withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 11, stiffness: 320, mass: 0.5 })
        )
      );
    }
    if (burst) {
      fly.value = 0;
      fly.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
    }
    // Keyed on the tap nonce alone: `lit`/`burst` are read at fire time and must
    // not retrigger on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[styles.star, { width: size, height: size }, popStyle]}>
      {children}
      {reduce
        ? null
        : Array.from({ length: PIPS }, (_, k) => (
            <Pip key={k} fly={fly} angle={(k / PIPS) * Math.PI * 2} size={size} gold={gold} />
          ))}
    </Animated.View>
  );
}

/** One flung star. Fixed angle, distance and fade scale off the host star's size. */
function Pip({
  fly,
  angle,
  size,
  gold,
}: {
  fly: SharedValue<number>;
  angle: number;
  size: number;
  gold: string;
}) {
  const dist = size * 1.15;
  const style = useAnimatedStyle(() => ({
    // At rest fly is 0, and 1 - 0 would leave eight stars parked on top of the
    // real one — so idle is explicitly invisible.
    opacity: fly.value === 0 ? 0 : 1 - fly.value,
    transform: [
      { translateX: Math.cos(angle) * dist * fly.value },
      { translateY: Math.sin(angle) * dist * fly.value },
      { scale: 1 - fly.value * 0.55 },
    ],
  }));

  return (
    <Animated.View style={[styles.pip, style]} pointerEvents="none">
      <Ionicons name="star" size={size * 0.34} color={gold} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
  pip: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
