import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CardTextColor, cardInk } from '@/services/cardColors';

const OPTIONS: { key: CardTextColor; label: string }[] = [
  { key: 'white', label: 'White' },
  { key: 'black', label: 'Black' },
  { key: 'vermilion', label: 'Vermilion' },
];

// Text-colour control shared by both share composers (session card + review card).
// A swatch AND a label on every option — the choice must not be conveyed by colour
// alone, and "white" in particular is invisible as a swatch on the cream substrate
// without its ink ring.
export function CardColorPicker({
  value,
  onChange,
}: {
  value: CardTextColor;
  onChange: (c: CardTextColor) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.textSec }]}>COLOUR</Text>
      <View style={styles.options}>
        {OPTIONS.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(o.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label} text`}
              style={[
                styles.chip,
                {
                  borderColor: active ? t.accent : t.border,
                  backgroundColor: active ? t.accentMuted : 'transparent',
                },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: cardInk(o.key).primary, borderColor: t.border }]} />
              <Text style={[styles.chipText, { color: active ? t.accentText : t.textSec }]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The transparency checkerboard behind both composers' previews. It follows the
// chosen text colour: white text — the default — on the light cream checks was
// close to invisible, so the reader was previewing a card they could not read.
export function PreviewChecker({ textColor }: { textColor: CardTextColor }) {
  const [a, b] = textColor === 'white' ? ['#3A332B', '#2B2520'] : ['#E5E0D2', '#F6EEDF'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 9 }).map((_, r) => (
        <View key={r} style={styles.checkerRow}>
          {Array.from({ length: 7 }).map((_, c) => (
            <View key={c} style={[styles.checkerCell, { backgroundColor: (r + c) % 2 === 0 ? a : b }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  checkerRow: { flex: 1, flexDirection: 'row' },
  checkerCell: { flex: 1 },
  row: { gap: 8 },
  label: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1 },
  options: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH,
  },
  swatch: { width: 16, height: 16, borderRadius: RADIUS.full, borderWidth: 1 },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, ...NO_FONT_PAD },
});
