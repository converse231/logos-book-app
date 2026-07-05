import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { UserBook } from '@/services/types';
import { BookCover } from '@/components/shared/BookCover';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { getBookProgress } from './bookProgress';

interface BookGridCardProps {
  userBook: UserBook;
  width: number; // cover width = cell content width
  onPress: () => void;
}

// One shelf cell: cover + title + author + a status-aware footer (a live
// progress bar while reading, a finished marker, or a quiet status label).
function BookGridCardImpl({ userBook, width, onPress }: BookGridCardProps) {
  const t = useTheme();
  const { book, format, status } = userBook;
  const { pct } = getBookProgress(userBook);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.authors.join(', ')}`}
      style={({ pressed }) => [styles.cell, { width }, pressed && styles.pressed]}
    >
      <BookCover url={book.coverUrl} title={book.title} format={format} showFormatBadge width={width} />
      <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>
        {book.authors.join(', ')}
      </Text>

      <View style={styles.footer}>
        {status === 'reading' ? (
          <View style={styles.progressWrap}>
            <ProgressBar value={pct} max={1} height={6} animateOnMount={false} />
            <Text style={[styles.footMeta, { color: t.textTer }]}>{Math.round(pct * 100)}%</Text>
          </View>
        ) : status === 'finished' ? (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={14} color={t.accent} />
            <Text style={[styles.footMeta, { color: t.accent }]}>FINISHED</Text>
          </View>
        ) : status === 'dnf' ? (
          <Text style={[styles.footMeta, { color: t.textTer }]}>DID NOT FINISH</Text>
        ) : (
          <Text style={[styles.footMeta, { color: t.textTer }]}>WANT TO READ</Text>
        )}
      </View>
    </Pressable>
  );
}

export const BookGridCard = memo(BookGridCardImpl);

const styles = StyleSheet.create({
  cell: { gap: 6 },
  pressed: { opacity: 0.78 },
  title: { fontFamily: FONTS.uiBold, fontSize: 12, lineHeight: 16, marginTop: 4 },
  author: { fontFamily: FONTS.uiRegular, fontSize: 11 },
  footer: { marginTop: 2, minHeight: 16, justifyContent: 'center' },
  progressWrap: { gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footMeta: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
});
