import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS } from '@/theme/tokens';
import { coverGrid } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { BookSearchResult } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';

// Category / author results (reached from the Discover hub). `q` is the Google
// Books query (e.g. "subject:Mystery" or "inauthor:Brandon Sanderson"); `title`
// is the heading. Tapping a book opens its book page.
export default function Browse() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { title, q } = useLocalSearchParams<{ title?: string; q?: string }>();
  const { width } = useWindowDimensions();
  const { columns, cellWidth } = coverGrid(width, 3, 12);

  const [books, setBooks] = useState<BookSearchResult[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      setBooks(null);
      setPage(0);
      setExhausted(false);
      api
        .searchBooks(q ?? '')
        .then((r) => { if (alive) { setBooks(r); setExhausted(r.length === 0); } })
        .catch(() => alive && setError(true));
      return () => { alive = false; };
    }, [api, q, nonce])
  );

  // A category can run to hundreds of titles; the first page is only 20 of them.
  const loadMore = useCallback(() => {
    if (!books || loadingMore || exhausted) return;
    const next = page + 1;
    setLoadingMore(true);
    api.searchBooks(q ?? '', next)
      .then((more) => {
        if (more.length === 0) { setExhausted(true); return; }
        setBooks((prev) => {
          const seen = new Set((prev ?? []).map((b) => b.googleBooksId || b.title));
          return [...(prev ?? []), ...more.filter((b) => !seen.has(b.googleBooksId || b.title))];
        });
        setPage(next);
      })
      .catch(() => setExhausted(true))
      .finally(() => setLoadingMore(false));
  }, [api, q, books, page, loadingMore, exhausted]);

  const openBook = (b: BookSearchResult) => {
    Haptics.selectionAsync();
    // The reader already picked this book — show them the book, not a search
    // for it. Passed whole rather than by id: the search result is already
    // complete, so refetching would only add a spinner.
    router.push({ pathname: '/book', params: { data: JSON.stringify(b), from: 'browse' } } as unknown as Href);
  };

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title ?? 'Browse'}</Text>
        {/* Layout spacer only — must NOT reuse roundBtn, whose border painted a
            phantom empty button here. */}
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : !books ? (
        <View style={styles.grid}>
          {Array.from({ length: columns * 2 }).map((_, i) => (
            <View key={i} style={{ width: cellWidth, gap: 5 }}>
              <Skeleton width={cellWidth} height={cellWidth / 0.66} radius={RADIUS.md} />
              <Skeleton width={cellWidth * 0.9} height={11} />
            </View>
          ))}
        </View>
      ) : books.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={28} color={t.textSec} />
          <Text style={[styles.emptyText, { color: t.textSec }]}>Nothing found here yet.</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          key={String(columns)}
          numColumns={columns}
          keyExtractor={(item, i) => `${item.googleBooksId}-${i}`}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 24 }]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={t.accent} style={styles.more} /> : null}
          renderItem={({ item }) => (
            <Pressable onPress={() => openBook(item)} accessibilityRole="button" accessibilityLabel={`${item.title} by ${item.authors.join(', ')}`} style={({ pressed }) => [styles.cell, { width: cellWidth }, pressed && { opacity: 0.75 }]}>
              <BookCover url={item.coverUrl} title={item.title} width={cellWidth} />
              <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={2}>{item.title}</Text>
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  roundBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: FONTS.displayBold, fontSize: 22, letterSpacing: -0.4, textAlign: 'center', textTransform: 'uppercase' },
  headerSpacer: { width: 42 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, gap: 12 },
  gridContent: { paddingHorizontal: 18, gap: 16 },
  gridRow: { gap: 12 },
  cell: { gap: 5 },
  more: { paddingVertical: 18 },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 12, lineHeight: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 15 },
});
