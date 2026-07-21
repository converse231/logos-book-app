import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { BookSearchResult } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';

// Category / author results (reached from the Discover hub). `q` is the Google
// Books query (e.g. "subject:Mystery" or "inauthor:Brandon Sanderson"); `title`
// is the heading. Tapping a book hands off to add-book pre-searched.
export default function Browse() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { title, q } = useLocalSearchParams<{ title?: string; q?: string }>();

  const [books, setBooks] = useState<BookSearchResult[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      setBooks(null);
      api
        .searchBooks(q ?? '')
        .then((r) => alive && setBooks(r))
        .catch(() => alive && setError(true));
      return () => { alive = false; };
    }, [api, q, nonce])
  );

  const openBook = (b: BookSearchResult) => {
    Haptics.selectionAsync();
    router.push(`/(modals)/add-book?q=${encodeURIComponent(`${b.title} ${b.authors[0] ?? ''}`.trim())}` as Href);
  };

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title ?? 'Browse'}</Text>
        <View style={styles.roundBtn} />
      </View>

      {error ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : !books ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.cell}><Skeleton width="100%" height={170} radius={14} /></View>
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
          numColumns={3}
          keyExtractor={(item, i) => `${item.googleBooksId}-${i}`}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 24 }]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => openBook(item)} accessibilityRole="button" accessibilityLabel={`${item.title} by ${item.authors.join(', ')}`} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.75 }]}>
              <View style={[styles.coverFrame, { borderColor: t.border }]}>
                <BookCover url={item.coverUrl} title={item.title} width={104} />
              </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10 },
  gridContent: { paddingHorizontal: 14, gap: 16 },
  gridRow: { gap: 10 },
  cell: { flex: 1 / 3, gap: 5, maxWidth: '33%' },
  coverFrame: { borderWidth: 2, borderRadius: 14, alignSelf: 'flex-start' },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 12, lineHeight: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 15 },
});
