import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';

interface StarRatingProps {
  value: number;
  /** When provided the stars become tappable. Omit for display-only. */
  onChange?: (rating: number) => void;
  /** Half-star precision: a tap on the left half of a star scores x.5. */
  allowHalf?: boolean;
  size?: number;
  color?: string;
}

// Display + input star rating. Renders half-star glyphs for fractional values.
// Interactive mode uses one Pressable per star and reads the tap's locationX to
// decide half vs full — simple and reliable (no overlapping touch zones).
export function StarRating({ value, onChange, allowHalf = false, size = 18, color }: StarRatingProps) {
  const t = useTheme();
  const gold = color ?? t.gold;
  const interactive = typeof onChange === 'function';

  const glyphFor = (i: number) => {
    const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
    const lit = value >= i - 0.5;
    return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={lit ? gold : t.textTer} />;
  };

  return (
    <View style={[styles.row, { gap: size * 0.18 }]} accessibilityLabel={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (!interactive) return <View key={i}>{glyphFor(i)}</View>;
        return (
          <Pressable
            key={i}
            hitSlop={3}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${i} star${i > 1 ? 's' : ''}`}
            onPress={(e) => {
              const half = allowHalf && e.nativeEvent.locationX < size / 2;
              Haptics.selectionAsync();
              onChange!(half ? i - 0.5 : i);
            }}
            style={[styles.star, { width: size, height: size }]}
          >
            {glyphFor(i)}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
});
