import { useEffect } from 'react';
import { StyleSheet, TextInput, TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { FONTS } from '@/theme/tokens';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface CountUpProps {
  to: number;
  durationMs?: number;
  delayMs?: number;
  style?: TextStyle | TextStyle[];
}

// Counts from 0 → `to` driven entirely on the UI thread (animatedProps sets the
// TextInput's text), so it never re-renders the tree per frame — the same
// pattern the session timer/PPH counter will use. Tabular figures prevent width
// jitter as digits change.
export function CountUp({ to, durationMs = 1100, delayMs = 0, style }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      value.value = to;
      return;
    }
    value.value = 0;
    value.value = withTiming(to, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [to, durationMs, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => {
    return { text: String(Math.round(value.value)), defaultValue: String(Math.round(value.value)) } as any;
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      animatedProps={animatedProps}
      style={[styles.base, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FONTS.uiBold,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
});
