import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { BookFormat, BookSearchResult } from '@/services/types';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { BookCover } from '@/components/shared/BookCover';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const FORMATS: { key: BookFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'physical', label: 'Physical', icon: 'book-outline' },
  { key: 'ebook', label: 'E-book', icon: 'tablet-portrait-outline' },
  { key: 'audiobook', label: 'Audiobook', icon: 'headset-outline' },
];

// Add-to-shelf flow (blueprint Section 3). Step 1: browse recommendations or
// search the catalog. Step 2: pick a format and confirm. The mock persists the
// add in-session so the shelf reflects it immediately on return.
export default function AddBook() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  // When launched from the session picker we add straight to "currently reading".
  const { status } = useLocalSearchParams<{ status?: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [recommended, setRecommended] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [format, setFormat] = useState<BookFormat>('physical');
  const [adding, setAdding] = useState(false);
  const reqId = useRef(0);

  // Recommendations to fill the screen before any query.
  useEffect(() => {
    let alive = true;
    api.getRecommendedBooks().then((r) => alive && setRecommended(r));
    return () => {
      alive = false;
    };
  }, [api]);

  // Debounced live search; the latest request wins to avoid out-of-order results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const handle = setTimeout(() => {
      api.searchBooks(q).then((r) => {
        if (id === reqId.current) {
          setResults(r);
          setSearching(false);
        }
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [query, api]);

  const close = () => router.back();

  const confirmAdd = async () => {
    if (!selected || adding) return;
    setAdding(true);
    try {
      const added = await api.addBook(selected.googleBooksId, format);
      if (status === 'reading' && added.status !== 'reading') {
        await api.updateBookStatus(added.id, 'reading');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setAdding(false);
    }
  };

  const showingResults = query.trim().length > 0;
  const listData = showingResults ? results : recommended;

  const renderRow = ({ item }: { item: BookSearchResult }) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setSelected(item);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} by ${item.authors.join(', ')}`}
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
      </View>
      <Ionicons name="add-circle-outline" size={22} color={t.accent} />
    </Pressable>
  );

  return (
    <SheetScaffold title={selected ? 'Add to shelf' : 'Add a book'} onClose={close}>
      {selected ? (
        <View style={styles.confirm}>
          <View style={styles.selectedRow}>
            <BookCover url={selected.coverUrl} title={selected.title} width={64} />
            <View style={styles.selectedInfo}>
              <Text style={[styles.selTitle, { color: t.text }]} numberOfLines={2}>
                {selected.title}
              </Text>
              <Text style={[styles.selAuthor, { color: t.textSec }]} numberOfLines={1}>
                {selected.authors.join(', ')}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.changeLink, { color: t.accent }]}>Choose a different book</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.label, { color: t.textSec }]}>FORMAT</Text>
          <View style={styles.formatRow}>
            {FORMATS.map((f) => {
              const active = f.key === format;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFormat(f.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.formatPill,
                    { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
                  ]}
                >
                  <Ionicons name={f.icon} size={20} color={active ? t.accent : t.textSec} />
                  <Text style={[styles.formatText, { color: active ? t.accent : t.textSec }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton label="Add to shelf" onPress={confirmAdd} loading={adding} />
        </View>
      ) : (
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
                keyExtractor={(item) => item.googleBooksId}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  !showingResults && recommended.length > 0 ? (
                    <Text style={[styles.recHeader, { color: t.textSec }]}>POPULAR RIGHT NOW</Text>
                  ) : null
                }
                ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
                renderItem={renderRow}
              />
            )}
          </View>
        </View>
      )}
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
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  resultInfo: { flex: 1, gap: 2 },
  resultTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  resultAuthor: { fontFamily: FONTS.uiRegular, fontSize: 13 },

  confirm: { gap: 16, paddingBottom: 4 },
  selectedRow: { flexDirection: 'row', gap: 14 },
  selectedInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  selTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 17, lineHeight: 22 },
  selAuthor: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  changeLink: { fontFamily: FONTS.uiSemiBold, fontSize: 13, marginTop: 4 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  formatRow: { flexDirection: 'row', gap: 10 },
  formatPill: { flex: 1, gap: 6, height: 72, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formatText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
});
