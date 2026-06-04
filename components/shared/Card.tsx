import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { PALETTE, RADIUS, SHADOW } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  glow?: boolean; // accent glow halo behind the card (hero surfaces)
}

// Elevated surface for the dashboard. Depth via shadow (iOS) / elevation
// (Android) + a hairline top-lit border so cards read as floating layers rather
// than flat fills. `glow` adds an accent halo for hero cards.
export function Card({ children, style, padded = true, glow = false }: CardProps) {
  const t = useTheme();
  return (
    <View style={styles.outer}>
      {glow ? <View style={styles.glow} pointerEvents="none" /> : null}
      <View
        style={[
          styles.card,
          { backgroundColor: t.bgSec },
          padded && styles.padded,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  glow: {
    position: 'absolute',
    top: 10,
    left: 24,
    right: 24,
    bottom: -6,
    borderRadius: 28,
    backgroundColor: PALETTE.accentAlpha18,
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.cardBorder,
    ...SHADOW.card,
  },
  padded: { padding: 18 },
});
