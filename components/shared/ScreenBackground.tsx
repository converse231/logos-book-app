import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BG_GRADIENT, BG_GRADIENT_LIGHT } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeContext';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

// Cinematic theme-aware base: a subtle vertical gradient, plus two soft corner
// glow washes (accent top-right, gold bottom-left). The glows are diagonal
// gradients that fade to a matching zero-alpha stop — no hard-edged "blob"
// shapes, just an ambient tint. The accent glow drifts slowly for life
// (reduced-motion gated). Non-interactive, behind content, theme-aware.
export function ScreenBackground({ children }: ScreenBackgroundProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const grad = isDark ? BG_GRADIENT : BG_GRADIENT_LIGHT;

  // Same hue at full + zero alpha so the fade stays clean (no gray muddiness).
  const accentGlow = isDark ? 'rgba(61,123,255,0.16)' : 'rgba(61,123,255,0.08)';
  const goldGlow = isDark ? 'rgba(255,197,61,0.10)' : 'rgba(255,197,61,0.06)';
  const accentGlow0 = 'rgba(61,123,255,0)';
  const goldGlow0 = 'rgba(255,197,61,0)';

  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [drift, reduceMotion]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 22 - 11 },
      { translateY: drift.value * 18 - 9 },
    ],
  }));

  return (
    <View style={[styles.root, { backgroundColor: grad.colors[2] }]}>
      <LinearGradient colors={grad.colors} locations={grad.locations} style={StyleSheet.absoluteFill} />

      {/* Accent glow — top-right, fading toward centre */}
      <Animated.View pointerEvents="none" style={[styles.accentGlow, driftStyle]}>
        <LinearGradient
          colors={[accentGlow, accentGlow0]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Gold glow — bottom-left, fading toward centre */}
      <View pointerEvents="none" style={styles.goldGlow}>
        <LinearGradient
          colors={[goldGlow0, goldGlow]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  accentGlow: { position: 'absolute', top: -60, right: -60, width: '95%', height: '58%' },
  goldGlow: { position: 'absolute', bottom: -60, left: -60, width: '95%', height: '55%' },
});
