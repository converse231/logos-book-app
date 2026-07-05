import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE } from '@/theme/tokens';

interface StarRatingProps {
  value: number;
  /** When provided the stars become tappable. Omit for display-only. */
  onChange?: (rating: number) => void;
  /** Half-star precision: the LEFT half of a star scores x.5, the right half x. */
  allowHalf?: boolean;
  size?: number;
  color?: string;
}

// Display + input star rating. Stars are graphical, so they use the bright
// marigold gold on every substrate (the theme's text-gold is intentionally dull
// for contrast). Interactive half-star mode lays two transparent touch zones over
// each star (left = ½, right = full) — far more reliable than reading locationX.
export function StarRating({ value, onChange, allowHalf = false, size = 18, color }: StarRatingProps) {
  const t = useTheme();
  const gold = color ?? PALETTE.gold;
  const interactive = typeof onChange === 'function';

  const glyphFor = (i: number) => {
    const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
    const lit = value >= i - 0.5;
    return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={lit ? gold : t.textTer} />;
  };

  const pick = (r: number) => {
    Haptics.selectionAsync();
    onChange!(r);
  };

  return (
    <View style={[styles.row, { gap: size * 0.18 }]} accessibilityLabel={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (!interactive) return <View key={i}>{glyphFor(i)}</View>;
        return (
          <View key={i} style={[styles.star, { width: size, height: size }]}>
            {glyphFor(i)}
            {allowHalf ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${i - 0.5} stars`}
                  onPress={() => pick(i - 0.5)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[StyleSheet.absoluteFill, { right: size / 2 }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${i} stars`}
                  onPress={() => pick(i)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[StyleSheet.absoluteFill, { left: size / 2 }]}
                />
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rate ${i} star${i > 1 ? 's' : ''}`}
                onPress={() => pick(i)}
                hitSlop={6}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
});
