import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { BookSearchResult } from '@/services/types';
import { BookCover } from '@/components/shared/BookCover';
import { Skeleton } from '@/components/shared/Skeleton';

const COVER_W = 104;

// A titled horizontal carousel of book covers (For You, Trending, …). Tapping a
// cover bubbles the book up; "See all" is optional. Edge-bleeds to the screen
// edge like the home carousels.
export function DiscoverRow({
  title,
  subtitle,
  books,
  loading,
  onSeeAll,
  onTapBook,
}: {
  title: string;
  subtitle?: string;
  books: BookSearchResult[];
  loading?: boolean;
  onSeeAll?: () => void;
  onTapBook: (book: BookSearchResult) => void;
}) {
  const t = useTheme();

  if (!loading && books.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: t.textSec }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`} style={styles.seeAll}>
            <Text style={[styles.seeAllText, { color: t.accent }]}>SEE ALL</Text>
            <Ionicons name="chevron-forward" size={13} color={t.accent} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.skelRow}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={COVER_W} height={COVER_W * 1.5} radius={0} />
          ))}
        </View>
      ) : (
        <FlatList
          data={books}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item.googleBooksId}-${i}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onTapBook(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} by ${item.authors.join(', ')}`}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <View style={[styles.coverFrame, { borderColor: t.border }]}>
                <BookCover url={item.coverUrl} title={item.title} width={COVER_W} />
              </View>
              <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.bookAuthor, { color: t.textSec }]} numberOfLines={1}>{item.authors[0] ?? ''}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 18 },
  headText: { flex: 1, gap: 1 },
  title: { fontFamily: FONTS.displayBold, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  seeAllText: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 0.5 },
  listContent: { paddingHorizontal: 18, gap: 12 },
  skelRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  item: { width: COVER_W, gap: 5 },
  coverFrame: { borderWidth: 2, borderRadius: 14 },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 12, lineHeight: 15 },
  bookAuthor: { fontFamily: FONTS.mono, fontSize: 10 },
});
