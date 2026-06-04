import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { ReadingProjection } from '@/hooks/useReadingProjection';

interface GoalProjectionCardProps {
  projection: ReadingProjection;
}

// Live projection card (blueprint Section 13). Surfaces the "at X min/day you'll
// read ~N books and P pages by Dec 31" promise so the goal feels concrete and
// achievable. Numbers use tabular figures so the card doesn't reflow as the
// goal changes.
export function GoalProjectionCard({ projection }: GoalProjectionCardProps) {
  const t = useTheme();
  const { minPerDay, projectedBooks, projectedPages, deadlineLabel, isDecemberCrunch } = projection;

  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={styles.headerRow}>
        <Ionicons name="trending-up" size={18} color={t.accent} />
        <Text style={[styles.headerText, { color: t.accent }]}>YOUR PLAN</Text>
      </View>

      <Text style={[styles.headline, { color: t.text }]}>
        <Text style={{ color: t.accent }}>{minPerDay} min</Text>
        <Text style={{ color: t.textSec }}> / day</Text>
      </Text>

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      <View style={styles.statsRow}>
        <Stat value={String(projectedBooks)} label="books" color={t.text} sub={t.textSec} />
        <Stat value={fmt(projectedPages)} label="pages" color={t.text} sub={t.textSec} />
        <Stat value={deadlineLabel.replace('by ', '')} label="finish" color={t.text} sub={t.textSec} />
      </View>

      <Text style={[styles.caption, { color: t.textSec }]}>
        {isDecemberCrunch
          ? `An ambitious finish — ${minPerDay} min/day to close out the year.`
          : `At ${minPerDay} minutes a day, you’ll read ~${projectedBooks} books and ${fmt(projectedPages)} pages ${deadlineLabel}.`}
      </Text>
    </View>
  );
}

function Stat({ value, label, color, sub }: { value: string; label: string; color: string; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: sub }]}>{label}</Text>
    </View>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  headline: { fontFamily: FONTS.uiBold, fontSize: 34, fontVariant: ['tabular-nums'] },
  divider: { height: 1, opacity: 0.7 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 3 },
  statValue: { fontFamily: FONTS.uiBold, fontSize: 20, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: FONTS.uiMedium, fontSize: 12 },
  caption: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
});
