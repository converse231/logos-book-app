import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { UserBook } from '@/services/types';
import { BookCover } from '@/components/shared/BookCover';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getBookProgress } from './bookProgress';

interface BookListCardProps {
  userBook: UserBook;
  onPress: () => void;
}

// List-view shelf row: small cover + title/author + a status-aware footer line.
// Counterpart to BookGridCard for the library view toggle.
function BookListCardImpl({ userBook, onPress }: BookListCardProps) {
  const t = useTheme();
  const { book, format, status } = userBook;
  const { pct } = getBookProgress(userBook);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}
      style={({ pressed }) => [styles.row, { backgroundColor: t.bgSec, borderColor: t.border }, pressed && { opacity: 0.78 }]}
    >
      <View style={[styles.coverFrame, { borderColor: t.border }]}>
        <BookCover url={book.coverUrl} title={book.title} format={format} showFormatBadge width={48} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{book.title}</Text>
        <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>{book.authors.join(', ')}</Text>
        {status === 'reading' ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressFill}>
              <ProgressBar value={pct} max={1} height={5} animateOnMount={false} />
            </View>
            <Text style={[styles.meta, { color: t.textTer }]}>{Math.round(pct * 100)}%</Text>
          </View>
        ) : status === 'finished' ? (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={13} color={t.accent} />
            <Text style={[styles.meta, { color: t.accent }]}>FINISHED</Text>
          </View>
        ) : (
          <Text style={[styles.meta, { color: t.textTer }]}>{status === 'dnf' ? 'DID NOT FINISH' : 'WANT TO READ'}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textTer} />
    </Pressable>
  );
}

export const BookListCard = memo(BookListCardImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 0, borderWidth: BORDER_WIDTH },
  coverFrame: { borderWidth: 1, borderRadius: 0 },
  info: { flex: 1, gap: 2 },
  title: { fontFamily: FONTS.uiBold, fontSize: 15, lineHeight: 19 },
  author: { fontFamily: FONTS.uiRegular, fontSize: 12 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressFill: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  meta: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
});
