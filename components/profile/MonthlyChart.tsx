import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, PALETTE } from '@/theme/tokens';
import type { ChartBar } from '@/lib/profileStats';

const MAX_BAR_H = 96;

// Books-finished bar chart. 'year' scope passes 12 month bars; 'all' passes one
// bar per year. Flat neubrutalist bars (gold fill, ink border), value on top.
export function MonthlyChart({ bars }: { bars: ChartBar[] }) {
  const t = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.count));
  const anyData = bars.some((b) => b.count > 0);

  if (!anyData) {
    return (
      <View style={[styles.empty, { borderColor: t.border, backgroundColor: t.bgSec }]}>
        <Text style={[styles.emptyText, { color: t.textSec }]}>No finished books in this range yet.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={styles.row}>
        {bars.map((b, i) => {
          const h = b.count > 0 ? Math.max(6, (b.count / max) * MAX_BAR_H) : 0;
          return (
            <View key={i} style={styles.col}>
              <Text style={[styles.value, { color: b.count > 0 ? t.text : 'transparent' }]}>{b.count}</Text>
              <View style={styles.barTrack}>
                {h > 0 ? (
                  <View style={[styles.bar, { height: h, backgroundColor: PALETTE.gold, borderColor: t.border }]} />
                ) : (
                  <View style={[styles.barEmpty, { backgroundColor: t.bgTer }]} />
                )}
              </View>
              <Text style={[styles.label, { color: t.textTer }]} numberOfLines={1}>{b.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: BORDER_WIDTH, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontFamily: FONTS.monoBold, fontSize: 10, fontVariant: ['tabular-nums'] },
  barTrack: { height: MAX_BAR_H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '78%', borderRadius: 14, borderWidth: BORDER_WIDTH },
  barEmpty: { width: '78%', height: 3, borderRadius: 14 },
  label: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.2 },
  empty: { borderRadius: 14, borderWidth: BORDER_WIDTH, padding: 18, alignItems: 'center' },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center' },
});
