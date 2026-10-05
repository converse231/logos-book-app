import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, hardShadow, softStackShadow } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  glow?: boolean; // hero emphasis — heavier ink frame + deeper offset
}

// Soft-brutalist paper block: warm cream fill, thick ink border, gently ROUNDED
// corners, and a HARD offset drop-shadow warmed to ink. In light mode the offset
// is stacked with a whisper of warm ambient depth so the block reads like paper
// lifted off the page — the cozy warmth over neubrutalism's flat harshness, while
// the ink border + offset keep the confident bones. `glow` promotes the block to
// a hero surface by WEIGHT — a heavier frame and a deeper offset — not by colour.
// It used to frame the block in coral, which made the action colour decorative
// and diluted it everywhere a coral button meant "tap me".
export function Card({ children, style, padded = true, glow = false }: CardProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const offset = glow ? 6 : 4;
  // Ambient depth only on the light substrate (keeps dark crisp + Android cheap).
  const shadow = isDark ? hardShadow(t.shadow, offset) : softStackShadow(t.shadow, offset);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.bgSec,
          borderColor: t.border,
          borderWidth: glow ? BORDER_WIDTH_THICK : BORDER_WIDTH,
        },
        shadow,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card },
  padded: { padding: 18 },
});
