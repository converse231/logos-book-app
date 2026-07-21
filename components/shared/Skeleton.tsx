import { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE, RADIUS } from '@/theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Match the radius of whatever this stands in for (cards 20, rows/buttons 14,
   *  covers 14). Defaults to the soft small radius, which reads as a pill on
   *  text-line heights. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// Loading placeholder block (blueprint Section 12). A soft opacity pulse on a warm
// skeleton tone — reads as "loading" without the jank of a gradient sweep, and
// reserves the final layout's space to avoid content jump. Softly rounded to match
// the Paper & Ink surfaces it stands in for. Reduced-motion → a static muted block.
export function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm, style }: SkeletonProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.7);
  // Light mode needs a dedicated tone: bgTer sits too close to the oat paper bg to
  // read as a block. Dark's inset surface already separates from its substrate.
  const base = t.mode === 'dark' ? t.bgTer : PALETTE.skeletonBase;

  useEffect(() => {
    if (reduce) {
      opacity.value = 0.7;
      return;
    }
    // A gentle breath (never fading so far out that the block disappears).
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.62, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [reduce, opacity]);

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: base }, aStyle, style]}
    />
  );
}
