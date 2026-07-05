import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { BookFormat, BookSearchResult, ReadingStatus } from '@/services/types';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { BookCover } from '@/components/shared/BookCover';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { FinishedDatePicker } from '@/components/library/FinishedDatePicker';
import { track } from '@/lib/analytics';

const FORMATS: { key: BookFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'physical', label: 'Physical', icon: 'book-outline' },
  { key: 'ebook', label: 'E-book', icon: 'tablet-portrait-outline' },
  { key: 'audiobook', label: 'Audiobook', icon: 'headset-outline' },
];

// Final offset (px) of the hard ink shadow on the success cover.
const SHADOW_OFFSET = 9;

const SHELVES: { key: ReadingStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'want', label: 'Want', icon: 'bookmark-outline' },
  { key: 'tbr', label: 'TBR', icon: 'time-outline' },
  { key: 'reading', label: 'Reading', icon: 'book-outline' },
  { key: 'finished', label: 'Finished', icon: 'checkmark-circle-outline' },
];

// Add-to-shelf flow (blueprint Section 3). Step 1: browse recommendations or
// search the catalog. Step 2: pick a format and confirm. The mock persists the
// add in-session so the shelf reflects it immediately on return.
export default function AddBook() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  // `status` (from the session picker) adds straight to "currently reading";
  // `q` (from Logos AI) pre-seeds the search with a recommended title.
  const { status, q } = useLocalSearchParams<{ status?: string; q?: string }>();

  const [query, setQuery] = useState(q ?? '');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [recommended, setRecommended] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [format, setFormat] = useState<BookFormat>('physical');
  // Which shelf to land on. The session picker forces "reading"; the "Up next"
  // (TBR) entry point pre-selects "tbr"; otherwise the user picks (default
  // "want", or "finished" to backfill an already-read book).
  const [shelf, setShelf] = useState<ReadingStatus>(
    status === 'reading' ? 'reading' : status === 'tbr' ? 'tbr' : 'want'
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<BookSearchResult | null>(null); // success overlay
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const reduce = useReducedMotion();

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

  // Adding "Finished" asks for the month/year first (so backfilled reads land in
  // the right period); other shelves add immediately.
  const onConfirmPress = () => {
    if (!selected || adding) return;
    if (shelf === 'finished') {
      setDatePickerOpen(true);
      return;
    }
    performAdd();
  };

  const performAdd = async (finishedISO?: string) => {
    if (!selected || adding) return;
    setDatePickerOpen(false);
    setAdding(true);
    setError(null);
    try {
      const result = await api.addBook(selected, format);
      // addBook lands the book on "want"; promote it if the user chose otherwise.
      if (shelf === 'tbr') {
        await api.updateBookStatus(result.id, 'tbr');
      } else if (shelf === 'reading' && result.status !== 'reading') {
        await api.updateBookStatus(result.id, 'reading');
      } else if (shelf === 'finished') {
        await api.updateBookStatus(result.id, 'finished', finishedISO ?? new Date().toISOString());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('book_added', { source: status === 'reading' ? 'session_picker' : 'search', shelf });
      setAdding(false);
      setAdded(selected); // fire the success celebration overlay
    } catch (e: any) {
      setAdding(false);
      setError(e?.message ?? 'Could not add this book. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    <>
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

          <Text style={[styles.label, { color: t.textSec }]}>ADD TO</Text>
          <View style={styles.formatRow}>
            {SHELVES.map((s) => {
              const active = s.key === shelf;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShelf(s.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.formatPill,
                    { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
                  ]}
                >
                  <Ionicons name={s.icon} size={20} color={active ? t.accent : t.textSec} />
                  <Text style={[styles.formatText, { color: active ? t.accent : t.textSec }]} numberOfLines={1}>{s.label}</Text>
                </Pressable>
              );
            })}
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

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: t.bgSec, borderColor: t.danger }]}>
              <Ionicons name="alert-circle" size={18} color={t.danger} />
              <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={error ? 'Try again' : shelf === 'finished' ? 'Set finish date' : 'Add to shelf'}
            onPress={onConfirmPress}
            loading={adding}
          />
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

    <BookAddedOverlay book={added} reduce={reduce} accent={t.accent} onDone={close} />

    <FinishedDatePicker
      visible={datePickerOpen}
      onClose={() => setDatePickerOpen(false)}
      onConfirm={performAdd}
    />
    </>
  );
}

// Full-screen success celebration shown after a book lands on the shelf. Rendered
// via RN Modal so it escapes the bottom-sheet bounds and centres on the whole
// screen — big cover on a dark scrim, neubrutalist frame + check sticker, a light
// confetti burst. Auto-dismisses after ~2s; tap anywhere to continue sooner.
function BookAddedOverlay({
  book,
  reduce,
  accent,
  onDone,
}: {
  book: BookSearchResult | null;
  reduce: boolean;
  accent: string;
  onDone: () => void;
}) {
  const doneRef = useRef(false);
  // Drives the hard offset shadow: slides from flush (0,0) to its full offset and
  // fades in once the cover has cut in — the neubrutalist "block lifts off the page".
  const shadow = useSharedValue(0);

  useEffect(() => {
    if (!book) return;
    doneRef.current = false;
    shadow.value = 0;
    shadow.value = reduce ? 1 : withDelay(120, withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }));
    const handle = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 2100);
    return () => clearTimeout(handle);
  }, [book, onDone, reduce, shadow]);

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadow.value,
    transform: [
      { translateX: SHADOW_OFFSET * shadow.value },
      { translateY: SHADOW_OFFSET * shadow.value },
    ],
  }));

  if (!book) return null;

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={overlay.root} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Continue">
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(140)}
          style={overlay.coverWrap}
        >
          {/* Hard ink shadow as a real block behind the cover, so it can slide in. */}
          <Animated.View style={[overlay.shadowBlock, shadowStyle]} pointerEvents="none" />
          <View style={overlay.coverFrame}>
            <BookCover url={book.coverUrl} title={book.title} width={172} />
          </View>
          <View style={[overlay.sticker, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={26} color={PALETTE.onAccent} />
          </View>
        </Animated.View>

        <Animated.View entering={reduce ? undefined : FadeIn.delay(330).duration(360)} style={overlay.textBlock}>
          <Text style={[overlay.kicker, { color: accent }]}>ADDED TO YOUR LIBRARY</Text>
          <Text style={overlay.title} numberOfLines={3}>{book.title}</Text>
          {book.authors.length > 0 ? (
            <Text style={overlay.author} numberOfLines={1}>{book.authors.join(', ')}</Text>
          ) : null}
        </Animated.View>

        <Animated.Text
          entering={reduce ? undefined : FadeIn.delay(700).duration(400)}
          style={overlay.hint}
        >
          Tap anywhere to continue
        </Animated.Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchWrap: { gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: 0,
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
  formatPill: { flex: 1, gap: 6, height: 72, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formatText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: 0, borderWidth: BORDER_WIDTH_THICK,
  },
  errorText: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 13, lineHeight: 18 },
});

const overlay = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 24,
    backgroundColor: 'rgba(3,4,6,0.88)',
  },
  coverWrap: { alignItems: 'center', justifyContent: 'center' },
  // Sits behind the (opaque) cover frame; the animation translates it out to the
  // bottom-right so only the offset L-shape shows — a hard neubrutalist shadow.
  shadowBlock: { ...StyleSheet.absoluteFillObject, backgroundColor: PALETTE.ink, borderRadius: 0 },
  coverFrame: {
    borderWidth: BORDER_WIDTH_THICK, borderColor: PALETTE.ink, backgroundColor: PALETTE.paper,
    borderRadius: 0,
  },
  sticker: {
    position: 'absolute', top: -16, right: -16, width: 48, height: 48, borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK, borderColor: PALETTE.ink, alignItems: 'center', justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: 8 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, textAlign: 'center' },
  title: { fontFamily: FONTS.displayBold, fontSize: 26, lineHeight: 30, color: '#F4F1E8', textAlign: 'center' },
  author: { fontFamily: FONTS.uiMedium, fontSize: 15, color: 'rgba(244,241,232,0.7)', textAlign: 'center' },
  hint: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5, color: 'rgba(244,241,232,0.5)', textTransform: 'uppercase' },
});
