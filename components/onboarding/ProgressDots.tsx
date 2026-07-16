import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

interface ProgressDotsProps {
  total: number;
  current: number; // 0-indexed
}

// Multi-step progress indicator (UX `progress-indicators`). The active step
// stretches into a pill; completed/upcoming are dots. Announced as a single
// "Step X of N" label for screen readers.
export function ProgressDots({ total, current }: ProgressDotsProps) {
  const t = useTheme();
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} active={i === current} done={i < current} accent={t.accent} track={t.bgTer} />
      ))}
    </View>
  );
}

function Dot({
  active,
  done,
  accent,
  track,
}: {
  active: boolean;
  done: boolean;
  accent: string;
  track: string;
}) {
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(active ? 24 : 8, { duration: reduceMotion ? 0 : 220 }),
    backgroundColor: withTiming(active || done ? accent : track, {
      duration: reduceMotion ? 0 : 220,
    }),
  }));
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 14 },
});
