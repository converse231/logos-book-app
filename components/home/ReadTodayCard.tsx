import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/shared/AppIcon';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { StreakState, UserBook } from '@/services/types';
import { Card } from '@/components/shared/Card';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { localDateString } from '@/stores/sessionStore';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Fable-style daily check-in. Shows the current week (a flame on days read, today
// outlined) + an "I read today" button that opens the picker to log a quick
// session — for when you read but forgot to track it, so the streak survives.
//
// Two kinds of flame, because `readDates` comes from the heatmap — real sessions —
// and a RESTORED day has no session and never will. Fabricating one would poison
// pages, PPH, history and every average that reads reading_sessions, so instead
// the strip draws what the STREAK covers: the last `currentStreak` days ending at
// `lastReadLocalDate`. A covered day with no session is held, not read, and gets a
// hollow ember flame — the week reads continuous again without the heatmap lying.
//
// Derived from the streak itself rather than from a list of restore dates, so it
// stays correct for anything else that ever holds a day (a freeze, a grace period,
// a support fix) without another field to thread through.
export function ReadTodayCard({
  readDates,
  readToday,
  streak,
  activeBook,
  onLog,
}: {
  readDates: Set<string>;
  readToday: boolean;
  streak: StreakState;
  activeBook: UserBook | null;
  onLog: () => void;
}) {
  const t = useTheme();
  const today = new Date();
  const todayStr = localDateString(today);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // back to Sunday
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return localDateString(d);
  });

  // The streak's own span: `currentStreak` days ending on the last read date.
  // Compared as YYYY-MM-DD strings, which sort lexicographically, so no date
  // arithmetic is needed past building the one boundary.
  const last = streak.lastReadLocalDate;
  let firstCovered: string | null = null;
  if (last && streak.currentStreak > 0) {
    const d = new Date(`${last}T00:00:00`);
    d.setDate(d.getDate() - (streak.currentStreak - 1));
    firstCovered = localDateString(d);
  }
  const covers = (ds: string) => firstCovered != null && ds >= firstCovered && ds <= last!;

  return (
    <Card padded>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.title, { color: t.text }]}>
            {readToday ? 'Nice — logged for today' : 'Did you read today?'}
          </Text>

          <View style={styles.week}>
            {days.map((ds, i) => {
              const read = readDates.has(ds);
              // Held: inside the streak, but nothing was actually read that day.
              const held = !read && covers(ds);
              const isToday = ds === todayStr;
              const future = ds > todayStr;
              return (
                <View key={ds} style={styles.dayCol}>
                  <View
                    style={[
                      styles.dot,
                      read
                        ? { backgroundColor: t.accent, borderColor: t.accent }
                        : held
                        ? { backgroundColor: 'transparent', borderColor: t.ember }
                        : { backgroundColor: t.bgTer, borderColor: isToday ? t.accent : 'transparent' },
                    ]}
                    accessible
                    accessibilityLabel={
                      read ? 'Read' : held ? 'Streak held by a restore' : future ? 'Upcoming' : 'Not read'
                    }
                  >
                    {read ? (
                      <AppIcon name="flame" tint="cream" size={15} />
                    ) : held ? (
                      // Same flame, hollow ring, ember rather than coral: the week
                      // reads unbroken, and it still isn't claiming you read.
                      <AppIcon name="flame" tint="ember" size={15} />
                    ) : (
                      <Text style={[styles.dayLetter, { color: future ? t.textTer : t.textSec }]}>{LETTERS[i]}</Text>
                    )}
                  </View>
                  <View style={[styles.todayDot, isToday && { backgroundColor: t.accent }]} />
                </View>
              );
            })}
          </View>

          <PressBlock
            onPress={onLog}
            disabled={readToday}
            accessibilityLabel={readToday ? 'Already logged today' : 'Log that you read today'}
            accessibilityState={{ disabled: readToday }}
            style={[
              styles.btn,
              { backgroundColor: readToday ? t.bgTer : t.accent, borderColor: t.border },
            ]}
          >
            {readToday ? (
              <Ionicons name="checkmark" size={16} color={t.textSec} />
            ) : (
              <AppIcon name="flame" tint="cream" size={18} />
            )}
            <Text style={[styles.btnText, { color: readToday ? t.textSec : t.onAccent }]}>
              {readToday ? 'Read today' : 'I read today'}
            </Text>
          </PressBlock>
        </View>

        {activeBook ? (
          <View style={[styles.coverFrame, { borderColor: t.border }]}>
            <BookCover url={activeBook.book.coverUrl} title={activeBook.book.title} format={activeBook.format} width={64} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  left: { flex: 1, gap: 12 },
  title: { fontFamily: FONTS.displayBold, fontSize: 18, letterSpacing: -0.3 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: { width: 30, height: 30, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontFamily: FONTS.monoBold, fontSize: 12 },
  todayDot: { width: 4, height: 4, borderRadius: 14, backgroundColor: 'transparent' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: BORDER_WIDTH },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.3 },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 14 },
});
