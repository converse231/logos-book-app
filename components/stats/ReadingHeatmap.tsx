import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface HeatmapDay {
  date: string;
  minutes: number;
}

interface ReadingHeatmapProps {
  days: HeatmapDay[]; // oldest → newest
}

const CELL = 13;
const GAP = 3;
const ALPHAS = [0, 0.28, 0.5, 0.72, 1];

// GitHub-style contribution grid (blueprint Stats). Columns are weeks, rows are
// weekdays; intensity ramps the accent by minutes read. No SVG — plain Views, so
// it can't pull in an uninstalled dependency.
export function ReadingHeatmap({ days }: ReadingHeatmapProps) {
  const t = useTheme();

  // Pad the front so the first day lands on its real weekday row.
  const padFront = days.length ? new Date(days[0].date).getDay() : 0;
  const cells: (HeatmapDay | null)[] = [...Array(padFront).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const level = (m: number) => (m <= 0 ? 0 : m < 20 ? 1 : m < 45 ? 2 : m < 75 ? 3 : 4);
  const colorFor = (lvl: number) => (lvl === 0 ? t.bgTer : `rgba(61,123,255,${ALPHAS[lvl]})`);

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.col}>
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di];
              return (
                <View
                  key={di}
                  style={[styles.cell, { backgroundColor: cell ? colorFor(level(cell.minutes)) : 'transparent' }]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: t.textTer }]}>Less</Text>
        {[0, 1, 2, 3, 4].map((l) => (
          <View key={l} style={[styles.legendCell, { backgroundColor: colorFor(l) }]} />
        ))}
        <Text style={[styles.legendText, { color: t.textTer }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', gap: GAP },
  col: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendText: { fontFamily: FONTS.uiMedium, fontSize: 11, marginHorizontal: 2 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
});
