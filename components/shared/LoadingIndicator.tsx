import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

interface LoadingIndicatorProps {
  size?: number;
}

// Standalone "waiting" state (full-screen / section loads) — the bouncing-ball
// clip, alpha-keyed to a transparent background. Reduced-motion falls back to
// the platform ActivityIndicator rather than freezing on a mid-bounce frame.
export function LoadingIndicator({ size = 64 }: LoadingIndicatorProps) {
  const t = useTheme();
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Loading">
        <ActivityIndicator color={t.accent} size={size >= 48 ? 'large' : 'small'} />
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Image
        source={require('@/assets/loading-ball.webp')}
        style={{ width: size, height: size }}
        autoplay
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
