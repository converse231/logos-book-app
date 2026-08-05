import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS, SHADOW, NO_FONT_PAD } from '@/theme/tokens';
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
// Built as a pull-quote, not a data row: the reader's words are the largest thing
// on the card and everything else is attribution beneath a rule. The previous
// version led with a cover thumbnail and a title, which pushed the actual quote
// to third place and left the card reading like a list item.
//
// The opening beat carries the colour — an oversized coral quotation mark, or the
// gold stars when there are no words. Rating is words-optional (the book-detail
// screen takes stars on their own), so the second form is common, not an edge
// case: it states the rating in the same serif slot rather than being hidden.
export function ReviewQuoteCard({ bookTitle, coverUrl, format, rating, body, author, onPress }: ReviewQuoteCardProps) {
  const t = useTheme();
  const quote = body.trim();
  const initial = author.trim().charAt(0).toUpperCase() || 'R';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        quote
          ? `Review of ${bookTitle} by ${author}: ${quote}`
          : `${author} rated ${bookTitle} ${starLabel(rating)}`
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.bgSec, borderColor: t.border },
        pressed && styles.pressed,
      ]}
    >
      {/* The beat: a mark to open a quote, or the rating itself when there isn't one. */}
      {quote ? (
        <Text style={[styles.mark, { color: t.accent }]} allowFontScaling={false}>
          &ldquo;
        </Text>
      ) : (
        <View style={styles.markStars}>
          <StarRating value={rating} size={19} />
        </View>
      )}

      <Text style={[styles.quote, { color: t.text }]} numberOfLines={3}>
        {quote || `${author} rated this ${starLabel(rating)}`}
      </Text>

      <View style={[styles.rule, { backgroundColor: t.textTer }]} />

      <View style={styles.foot}>
        {quote ? (
          <View style={[styles.initial, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
            <Text style={[styles.initialText, { color: t.text }]}>{initial}</Text>
          </View>
        ) : (
          <BookCover url={coverUrl} title={bookTitle} format={format} width={26} />
        )}

        <View style={styles.footText}>
          {/* Attribution leads on a quote; on a bare rating the name is already in
              the sentence above, so the book takes the line instead. */}
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {quote ? author : bookTitle}
          </Text>
          <Text style={[styles.book, { color: t.textSec }]} numberOfLines={1}>
            {quote ? bookTitle : 'Rated'}
          </Text>
        </View>

        {quote ? <StarRating value={rating} size={12} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 288,
    minHeight: 196,
    borderRadius: RADIUS.card,
    borderWidth: BORDER_WIDTH,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    ...SHADOW.card,
  },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },

  // A typographic ornament, not a character in a sentence — 2.4x the body serif.
  // Deliberately NOT cropped to a fixed height smaller than its line box: a 64px
  // glyph forced into a 40px Text clips differently on iOS and Android, and this
  // reads as an ornament without needing the trick. Both beats occupy the same
  // 50px so the two card variants line up in a row.
  mark: { fontFamily: FONTS.serifBold, fontSize: 46, lineHeight: 50, ...NO_FONT_PAD },
  markStars: { height: 50, justifyContent: 'center' },

  quote: { fontFamily: FONTS.serifMedium, fontSize: 19, lineHeight: 26, ...NO_FONT_PAD },

  rule: { height: 1, opacity: 0.45, marginTop: 'auto' },

  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 },
  initial: {
    width: 28, height: 28, borderRadius: 14, borderWidth: BORDER_WIDTH,
    alignItems: 'center', justifyContent: 'center',
  },
  initialText: { fontFamily: FONTS.monoBold, fontSize: 12, ...NO_FONT_PAD },
  footText: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.uiBold, fontSize: 13 },
  book: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.4, marginTop: 1 },
});
