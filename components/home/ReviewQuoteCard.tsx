import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, RADIUS, SHADOW } from '@/theme/tokens';
import { BookCover } from '@/components/shared/BookCover';
import { StarRating } from '@/components/library/StarRating';
import { BookFormat } from '@/services/types';

interface ReviewQuoteCardProps {
  bookTitle: string;
  coverUrl: string | null;
  format: BookFormat;
  rating: number;
  body: string;
  author: string;
  onPress: () => void;
}

// A community review surfaced on Home. The quote is set in the literary serif to
// read like a pull-quote, not a UI string.
export function ReviewQuoteCard({ bookTitle, coverUrl, format, rating, body, author, onPress }: ReviewQuoteCardProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review of ${bookTitle} by ${author}`}
      style={({ pressed }) => [styles.card, { backgroundColor: t.bgSec }, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <BookCover url={coverUrl} title={bookTitle} format={format} width={40} />
        <View style={styles.headText}>
          <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={1}>
            {bookTitle}
          </Text>
          <StarRating value={rating} size={13} />
        </View>
      </View>

      <Text style={[styles.quote, { color: t.text }]} numberOfLines={3}>
        “{body}”
      </Text>

      <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>
        {author}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 288,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.cardBorder,
    padding: 16,
    gap: 12,
    ...SHADOW.sm,
  },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 5 },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  quote: { fontFamily: FONTS.displayMedium, fontSize: 19, lineHeight: 25 },
  author: { fontFamily: FONTS.uiSemiBold, fontSize: 12 },
});
