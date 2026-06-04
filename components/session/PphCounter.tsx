import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface PphCounterProps {
  pagesRead: number;
  elapsedSeconds: number;
  align?: 'center' | 'flex-start';
}

// Pages-per-hour readout (blueprint #6). Used in the reveal + celebration where
// pagesRead is known. Tabular figures; guards divide-by-zero.
export function PphCounter({ pagesRead, elapsedSeconds, align = 'center' }: PphCounterProps) {
  const t = useTheme();
  const pph = elapsedSeconds > 0 ? Math.round((pagesRead / (elapsedSeconds / 3600)) * 10) / 10 : 0;

  return (
    <View
      style={[styles.wrap, { alignItems: align }]}
      accessibilityLabel={`Reading speed ${pph} pages per hour`}
    >
      <Text style={[styles.value, { color: t.text }]}>{pph}</Text>
      <Text style={[styles.label, { color: t.textSec }]}>pages / hr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  value: { fontFamily: FONTS.uiBold, fontSize: 28, fontVariant: ['tabular-nums'] },
  label: { fontFamily: FONTS.uiMedium, fontSize: 13 },
});
