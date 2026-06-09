import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { BORDER_WIDTH, BORDER_WIDTH_THICK, hardShadow } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  glow?: boolean; // hero emphasis — accent border + accent hard-shadow block
}

// Neubrutalist block: flat fill, thick ink border, SHARP corners, and a HARD
// offset drop-shadow (no blur). `glow` promotes the block to an accent-framed
// hero surface (accent border + accent-coloured hard shadow). Depth comes from
// the border + offset, never from soft shadow or translucency.
export function Card({ children, style, padded = true, glow = false }: CardProps) {
  const t = useTheme();
  const frame = glow ? t.accent : t.border;
  const shadow = t.mode === 'dark' ? (glow ? t.accent : '#000000') : frame;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.bgSec,
          borderColor: frame,
          borderWidth: glow ? BORDER_WIDTH_THICK : BORDER_WIDTH,
        },
        hardShadow(shadow, glow ? 5 : 4),
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 0 },
  padded: { padding: 18 },
});
