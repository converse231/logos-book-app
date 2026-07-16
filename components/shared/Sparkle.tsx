import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';

// A single four-point "twinkle" sparkle — the hand-drawn doodle from the Paper &
// Ink inspiration boards. Concave star path; optional slow twinkle (opacity +
// scale) with a per-sparkle delay so a cluster shimmers out of sync. Purely
// decorative (pointerEvents none, no a11y). Colour is passed in so callers can
// scatter the reward palette (gold / lilac / ember / coral) as delight.
const SPARK =
  'M12 0 C12.6 6.4 17.6 11.4 24 12 C17.6 12.6 12.6 17.6 12 24 C11.4 17.6 6.4 12.6 0 12 C6.4 11.4 11.4 6.4 12 0 Z';

interface SparkleProps {
  size?: number;
  color: string;
  /** ms offset so clustered sparkles twinkle out of phase. */
  delay?: number;
  twinkle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Sparkle({ size = 16, color, delay = 0, twinkle = true, style }: SparkleProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(twinkle && !reduce ? 0 : 1);

  useEffect(() => {
    if (!twinkle || reduce) return;
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );
  }, [twinkle, reduce, delay, p]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.65,
    transform: [{ scale: 0.65 + p.value * 0.35 }],
  }));

  return (
    <Animated.View style={[aStyle, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARK} fill={color} />
      </Svg>
    </Animated.View>
  );
}
