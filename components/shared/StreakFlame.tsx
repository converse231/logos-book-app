import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface StreakFlameProps {
  count: number;
  isAtRisk?: boolean;
  size?: number;
}

// The biggest element on Home (blueprint #3). Loss-aversion centrepiece: a
// pulsing flame + day count. Emerald normally, amber when the streak is at risk.
// Pulse is reduced-motion gated. At-risk state is conveyed by colour AND the
// accessibility label (not colour alone).
export function StreakFlame({ count, isAtRisk = false, size = 96 }: StreakFlameProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const color = isAtRisk ? t.gold : t.accent;

  const scale = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    if (reduceMotion) return;
    const dur = isAtRisk ? 600 : 1100; // faster, more urgent when at risk
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    glow.value = withRepeat(
      withSequence(withTiming(0.7, { duration: dur }), withTiming(0.4, { duration: dur })),
      -1,
      false
    );
  }, [scale, glow, reduceMotion, isAtRisk]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`Current streak: ${count} ${count === 1 ? 'day' : 'days'}.${isAtRisk ? ' At risk.' : ''}`}
    >
      <View style={[styles.flameBox, { width: size, height: size }]}>
        <Animated.View style={[styles.glow, glowStyle, { backgroundColor: color, width: size * 0.85, height: size * 0.85, borderRadius: size }]} />
        <Animated.View style={flameStyle}>
          <Ionicons name="flame" size={size * 0.62} color={color} />
        </Animated.View>
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.count, { color: t.text }]}>{count}</Text>
        <Text style={[styles.unit, { color: t.textSec }]}>
          {isAtRisk ? 'day streak · at risk' : `day streak`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  flameBox: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  labelRow: { alignItems: 'center' },
  count: { fontFamily: FONTS.uiBold, fontSize: 52, lineHeight: 58, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: FONTS.uiMedium, fontSize: 14, marginTop: -2 },
});
