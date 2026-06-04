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

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// Loading placeholder block (blueprint Section 12). A soft opacity pulse on a
// token-driven surface (bgTer) — reads as "loading" without the jank of a
// gradient sweep, and reserves the final layout's space to avoid content jump.
// Reduced-motion → a static muted block.
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reduce) {
      opacity.value = 0.6;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 750, easing: Easing.inOut(Easing.ease) })
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
      style={[{ width, height, borderRadius: radius, backgroundColor: t.bgTer }, aStyle, style]}
    />
  );
}
