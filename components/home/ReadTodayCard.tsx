import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { UserBook } from '@/services/types';
import { Card } from '@/components/shared/Card';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { localDateString } from '@/stores/sessionStore';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Fable-style daily check-in. Shows the current week (a flame on days read, today
// outlined) + an "I read today" button that opens the picker to log a quick
// session — for when you read but forgot to track it, so the streak survives.
export function ReadTodayCard({
  readDates,
  readToday,
  activeBook,
  onLog,
}: {
  readDates: Set<string>;
  readToday: boolean;
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
              const isToday = ds === todayStr;
              const future = ds > todayStr;
              return (
                <View key={ds} style={styles.dayCol}>
                  <View
                    style={[
                      styles.dot,
                      read
                        ? { backgroundColor: t.accent, borderColor: t.accent }
                        : { backgroundColor: t.bgTer, borderColor: isToday ? t.accent : 'transparent' },
                    ]}
                  >
                    {read ? (
                      <Ionicons name="flame" size={13} color={t.onAccent} />
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
            <Ionicons name={readToday ? 'checkmark' : 'flame'} size={16} color={readToday ? t.textSec : t.onAccent} />
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
  dot: { width: 30, height: 30, borderRadius: 0, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontFamily: FONTS.monoBold, fontSize: 12 },
  todayDot: { width: 4, height: 4, borderRadius: 0, backgroundColor: 'transparent' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 0, borderWidth: BORDER_WIDTH },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.3 },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 0 },
});
