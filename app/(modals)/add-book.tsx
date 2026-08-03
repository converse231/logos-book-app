import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { BookSearchResult, ReadingStatus, UserBook } from '@/services/types';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { BookCover } from '@/components/shared/BookCover';
import { buildOwnedLookup, findOwned } from '@/lib/ownedBooks';

// Friendly shelf names for the "already on your shelf" flag on search rows.
const SHELF_LABEL: Record<ReadingStatus, string> = {
  want: 'Wishlist',
  tbr: 'On your TBR',
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'Set aside',
};

// "already owned" status green — a semantic done/owned colour, separate from the
// reward accent palette.
const OWNED_GREEN = '#5E8C4F';

/** Identity for de-duplicating across pages — mirrors the catalog's own merge key. */
const resultKey = (b: BookSearchResult) =>
  `${b.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${(b.authors[0] ?? '').toLowerCase()}`;

/** Warm the covers for a page of results so tapping through feels instant. Purely
 *  opportunistic — failures are ignored, and expo-image dedupes against its cache. */
function prefetchCovers(list: BookSearchResult[]) {
  const urls = list.slice(0, 10).map((b) => b.coverUrl).filter(Boolean) as string[];
  if (urls.length) ExpoImage.prefetch(urls).catch(() => {});
}

// FIND a book (blueprint Section 3): browse recommendations, search the catalog, or
// scan an ISBN. Tapping a result opens its BOOK PAGE, which is where shelf, format
// and the actual add now live — this sheet used to own a second "confirm" step, which
// meant the catalog told you nothing about a book before you committed to it.
export default function AddBook() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  // `status` (from the session picker) adds straight to "currently reading";
  // `q` (from Quire AI) pre-seeds the search with a recommended title.
  const { status, q } = useLocalSearchParams<{ status?: string; q?: string }>();

  const [query, setQuery] = useState(q ?? '');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [recommended, setRecommended] = useState<BookSearchResult[]>([]);
  const [owned, setOwned] = useState<UserBook[]>([]);
  const [searching, setSearching] = useState(false);
  // Paging state for the live search. `exhausted` stops us asking for a page the
  // catalog has already told us doesn't exist.
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const reqId = useRef(0);

  // Recommendations fill the screen before any query. Static enough to fetch once.
  useEffect(() => {
    let alive = true;
    api.getRecommendedBooks().then((r) => alive && setRecommended(r));
    return () => {
      alive = false;
    };
  }, [api]);

  // The shelf, so rows can flag books already owned. Re-read on FOCUS, not just on
  // mount: adding now happens on the book page pushed above this sheet, so coming
  // back has to show the new "On your shelf" flag on the row you just tapped.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getUserBooks().then((b) => alive && setOwned(b)).catch(() => {});
      return () => {
        alive = false;
      };
    }, [api])
  );

  const ownedLookup = useMemo(() => buildOwnedLookup(owned), [owned]);

  // Debounced live search; the latest request wins to avoid out-of-order results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setPage(0);
    setExhausted(false);
    const id = ++reqId.current;
    const handle = setTimeout(() => {
      api.searchBooks(q).then((r) => {
        if (id !== reqId.current) return;
        setResults(r);
        setSearching(false);
        setExhausted(r.length === 0);
        prefetchCovers(r);
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [query, api]);

  // Pull the next page when the list nears its end. Guarded on every axis that
  // could otherwise fire a duplicate request: a search already in flight, a page
  // already loading, or a catalog that has run out of results.
  const loadMore = useCallback(() => {
    const q = query.trim();
    if (!q || searching || loadingMore || exhausted) return;
    const next = page + 1;
    const id = reqId.current;
    setLoadingMore(true);
    api.searchBooks(q, next)
      .then((more) => {
        if (id !== reqId.current) return; // the query changed under us
        if (more.length === 0) {
          setExhausted(true);
        } else {
          // The two catalogs can return the same work on consecutive pages, so the
          // merge has to happen across pages too, not just within one.
          setResults((prev) => {
            const seen = new Set(prev.map(resultKey));
            return [...prev, ...more.filter((b) => !seen.has(resultKey(b)))];
          });
          setPage(next);
          prefetchCovers(more);
        }
      })
      .finally(() => setLoadingMore(false));
  }, [api, query, page, searching, loadingMore, exhausted]);

  const close = () => router.back();

  // A tapped result opens its book page. `status` rides along so the entry point's
  // intent survives the hop — arriving from the session picker still pre-selects
  // "Reading" over there, and from "Up next" still pre-selects TBR.
  const openBook = (b: BookSearchResult) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/book',
      params: {
        data: JSON.stringify(b),
        status: status ?? '',
        from: status === 'reading' ? 'session_picker' : 'search',
      },
    } as unknown as Href);
  };

  const showingResults = query.trim().length > 0;
  const listData = showingResults ? results : recommended;

  const renderRow = ({ item }: { item: BookSearchResult }) => {
    const ownedBook = findOwned(ownedLookup, item);
    return (
      <Pressable
        onPress={() => openBook(item)}
        accessibilityRole="button"
        accessibilityLabel={
          ownedBook
            ? `${item.title} by ${item.authors.join(', ')}. Already on your shelf: ${SHELF_LABEL[ownedBook.status]}`
            : `${item.title} by ${item.authors.join(', ')}`
        }
        style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.7 }]}
      >
        <BookCover url={item.coverUrl} title={item.title} width={44} />
        <View style={styles.resultInfo}>
          <Text style={[styles.resultTitle, { color: t.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.resultAuthor, { color: t.textSec }]} numberOfLines={1}>
            {item.authors.join(', ')}
            {item.publishedYear ? ` · ${item.publishedYear}` : ''}
          </Text>
          {ownedBook ? (
            <View style={styles.ownedChip}>
              <Ionicons name="checkmark-circle" size={13} color={OWNED_GREEN} />
              <Text style={[styles.ownedText, { color: OWNED_GREEN }]} numberOfLines={1}>
                On your shelf · {SHELF_LABEL[ownedBook.status]}
              </Text>
            </View>
          ) : null}
        </View>
        {/* A chevron, not a plus: the tap opens the book rather than adding it. */}
        <Ionicons
          name={ownedBook ? 'checkmark-circle' : 'chevron-forward'}
          size={ownedBook ? 22 : 18}
          color={ownedBook ? OWNED_GREEN : t.textTer}
        />
      </Pressable>
    );
  };

  return (
    <SheetScaffold title="Find a book" onClose={close}>
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: t.bgTer, borderColor: t.border }]}>
          <Ionicons name="search" size={18} color={t.textSec} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title or author"
            placeholderTextColor={t.textTer}
            style={[styles.searchInput, { color: t.text }]}
            returnKeyType="search"
            accessibilityLabel="Search the catalog"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear">
              <Ionicons name="close-circle" size={18} color={t.textTer} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.replace('/(modals)/scanner' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Scan an ISBN instead"
          style={({ pressed }) => [styles.scanRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="barcode-outline" size={18} color={t.accent} />
          <Text style={[styles.scanText, { color: t.accent }]}>Scan an ISBN instead</Text>
        </Pressable>

        <View style={styles.resultsArea}>
          {showingResults && searching ? (
            <View style={styles.searchState}>
              <ActivityIndicator color={t.accent} />
            </View>
          ) : showingResults && results.length === 0 ? (
            <Text style={[styles.searchEmpty, { color: t.textSec }]}>No results for &ldquo;{query.trim()}&rdquo;.</Text>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item, i) => `${item.googleBooksId}-${i}`}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              ListHeaderComponent={
                !showingResults && recommended.length > 0 ? (
                  <Text style={[styles.recHeader, { color: t.textSec }]}>POPULAR RIGHT NOW</Text>
                ) : null
              }
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
              renderItem={renderRow}
              onEndReached={showingResults ? loadMore : undefined}
              onEndReachedThreshold={0.6}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.moreRow}>
                    <ActivityIndicator color={t.accent} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  searchWrap: { gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 15, padding: 0 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  scanText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  resultsArea: { height: 380 },
  recHeader: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  searchState: { paddingTop: 40, alignItems: 'center' },
  searchEmpty: { fontFamily: FONTS.uiRegular, fontSize: 14, paddingTop: 24, textAlign: 'center' },
  sep: { height: StyleSheet.hairlineWidth },
  moreRow: { paddingVertical: 16, alignItems: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  resultInfo: { flex: 1, gap: 2 },
  resultTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  resultAuthor: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  ownedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ownedText: { fontFamily: FONTS.uiSemiBold, fontSize: 11, letterSpacing: 0.2 },

});
