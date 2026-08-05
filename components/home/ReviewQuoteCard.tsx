import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, SHADOW } from '@/theme/tokens';
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

/** "5 stars", "4.5 stars", "1 star" — ratings persist in 0.5 steps, so whole
 *  numbers must not render as "5.0". */
function starLabel(rating: number): string {
  const n = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  return `${n} ${rating === 1 ? 'star' : 'stars'}`;
}

// A community review surfaced on Home, in one of two forms.
//
// Rating is words-optional — the book-detail screen takes stars on their own — so
// plenty of reviews have no prose. Rather than hide those, they render as a stated
// rating ("Daniel rated this 5 stars") in the same serif slot the pull-quote uses.
// Same card, same shape, still says something true about the book.
export function ReviewQuoteCard({ bookTitle, coverUrl, format, rating, body, author, onPress }: ReviewQuoteCardProps) {
  const t = useTheme();
  // Ratings are words-optional — the book-detail screen lets you leave stars without
  // writing anything — so `body` is routinely empty. Rendering it anyway produced a
  // pair of quote marks with nothing between them.
  const quote = body.trim();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review of ${bookTitle} by ${author}`}
      style={({ pressed }) => [styles.card, { backgroundColor: t.bgSec, borderColor: t.border }, pressed && styles.pressed]}
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

      {quote ? (
        <>
          <Text style={[styles.quote, { color: t.text }]} numberOfLines={3}>
            “{quote}”
          </Text>
          <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>
            {author}
          </Text>
        </>
      ) : (
        // Rated-only: the same serif slot, but the sentence IS the statement, so
        // the separate byline underneath would just repeat the name.
        <Text style={[styles.quote, { color: t.text }]} numberOfLines={3}>
          {author} rated this {starLabel(rating)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 288,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
    padding: 16,
    gap: 12,
    ...SHADOW.card,
  },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 5 },
  bookTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  quote: { fontFamily: FONTS.displayMedium, fontSize: 19, lineHeight: 25 },
  author: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' },
});
