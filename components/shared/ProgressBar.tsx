import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

interface ProgressBarProps {
  value: number;
  max: number;
  accent?: string;
  height?: number;
  animateOnMount?: boolean;
}

// Fabric-safe progress bar. Reanimated's useAnimatedStyle must not contain
// percentage strings — New Architecture (Fabric) normalises "80%" to the float
// 0.8 when converting to native, causing a "loss of precision" hard crash.
// Solution: measure the container with onLayout and animate with pixel values.
export function ProgressBar({
  value,
  max,
  accent,
  height = 8,
  animateOnMount = true,
}: ProgressBarProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const radius = 0; // brutalism — sharp corners

  const [trackWidth, setTrackWidth] = useState(0);
  const fillPx = useSharedValue(0);

  useEffect(() => {
    if (trackWidth === 0) return;
    const target = pct * trackWidth;
    if (reduceMotion || !animateOnMount) {
      fillPx.value = target;
    } else {
      fillPx.value = withSpring(target, { damping: 18, stiffness: 120 });
    }
  }, [pct, trackWidth, reduceMotion, animateOnMount, fillPx]);

  // Only pixel numbers here — no percentage strings
  const fillStyle = useAnimatedStyle(() => ({ width: fillPx.value }));

  return (
    <View
      style={[styles.track, { height, borderRadius: radius, backgroundColor: t.bgTer, borderColor: t.border }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      // Fabric types accessibilityValue.now/min/max as integers (long long).
      // Passing a fractional value (e.g. 0.8 from a 12/15 progress) crashes on
      // native node creation. Report integer percent instead — correct for any
      // value/max (fractions or page counts) and always an integer.
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100), text: `${Math.round(pct * 100)} percent` }}
    >
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          { height, borderRadius: radius, backgroundColor: accent ?? t.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderWidth: 1 },
  fill: { position: 'absolute', left: 0, top: 0 },
});
