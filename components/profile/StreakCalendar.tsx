import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { localDateString } from '@/stores/sessionStore';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Reading-streak calendar: a month grid where days you read show that day's book
// cover instead of the date. Read days with no cover (e.g. an audiobook) show a
// filled accent block. ‹ › navigate months. Covers map: 'YYYY-MM-DD' → cover|null.
// onSelectDate (optional): when provided, read days become tappable (e.g. to view
// that day's sessions).
export function StreakCalendar({
  covers,
  onSelectDate,
}: {
  covers: Map<string, string | null>;
  onSelectDate?: (date: string) => void;
}) {
  const t = useTheme();
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const today = localDateString();

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const shift = (delta: number) => {
    Haptics.selectionAsync();
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };
  // Don't let users page into the future.
  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();

  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={styles.head}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month" style={[styles.navBtn, { borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={18} color={t.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: t.text }]}>{MONTHS[view.month]} {view.year}</Text>
        <Pressable
          onPress={() => !atCurrentMonth && shift(1)}
          hitSlop={10}
          disabled={atCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[styles.navBtn, { borderColor: t.border, opacity: atCurrentMonth ? 0.3 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={18} color={t.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: t.textTer }]}>{d}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.cell} />;
            const date = ymd(view.year, view.month, day);
            const read = covers.has(date);
            const cover = read ? covers.get(date) : null;
            const isToday = date === today;
            const tappable = read && !!onSelectDate;
            const dayStyle = [
              styles.day,
              read && { borderColor: t.border, borderWidth: BORDER_WIDTH },
              !read && { backgroundColor: t.bgTer },
              isToday && !read && { borderColor: t.accent, borderWidth: BORDER_WIDTH },
            ];
            const inner =
              read && cover ? (
                <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
              ) : read ? (
                <View style={[styles.readBlock, { backgroundColor: t.accent }]}>
                  <Ionicons name="checkmark" size={14} color={t.onAccent} />
                </View>
              ) : (
                <Text style={[styles.dayNum, { color: isToday ? t.accent : t.textSec }]}>{day}</Text>
              );
            return (
              <View key={di} style={styles.cell}>
                {tappable ? (
                  <Pressable
                    onPress={() => { Haptics.selectionAsync(); onSelectDate!(date); }}
                    accessibilityRole="button"
                    accessibilityLabel={`View sessions for ${MONTHS[view.month]} ${day}`}
                    style={({ pressed }) => [dayStyle, pressed && { opacity: 0.7 }]}
                  >
                    {inner}
                  </Pressable>
                ) : (
                  <View style={dayStyle}>{inner}</View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: BORDER_WIDTH, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  navBtn: { width: 32, height: 32, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: FONTS.displayBold, fontSize: 16, letterSpacing: -0.3, textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, paddingVertical: 2 },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  readBlock: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: FONTS.mono, fontSize: 12, fontVariant: ['tabular-nums'] },
});
