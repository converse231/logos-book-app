import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import {
  FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD,
  GENRE_PALETTE, hardShadow,
} from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { BookFormat, BookSearchResult, ReadingStatus, UserBook } from '@/services/types';
import { buildOwnedLookup, findOwned } from '@/lib/ownedBooks';
import { track } from '@/lib/analytics';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { Q } from '@/components/shared/Q';
import { FinishedDatePicker } from '@/components/library/FinishedDatePicker';
import { BookAddedOverlay } from '@/components/library/BookAddedOverlay';

const SHELVES: { key: ReadingStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'want', label: 'Want', icon: 'bookmark-outline' },
  { key: 'tbr', label: 'TBR', icon: 'time-outline' },
  { key: 'reading', label: 'Reading', icon: 'book-outline' },
  { key: 'finished', label: 'Finished', icon: 'checkmark-circle-outline' },
];

const FORMATS: { key: BookFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'physical', label: 'Physical', icon: 'book-outline' },
  { key: 'ebook', label: 'E-book', icon: 'tablet-portrait-outline' },
  { key: 'audiobook', label: 'Audiobook', icon: 'headset-outline' },
];

const SHELF_LABEL: Record<ReadingStatus, string> = {
  want: 'Wishlist',
  tbr: 'On your TBR',
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'Set aside',
};

/** "already owned" status green — a semantic done/owned colour, deliberately
 *  outside the reward accent palette. */
const OWNED_GREEN = '#5E8C4F';

const COVER_W = 168;

/**
 * Parse and VALIDATE the book payload from the route.
 *
 * `/book?data=…` is reachable over the `quire://` scheme, so this param is
 * attacker-controllable: a crafted link could otherwise put arbitrary prose on a
 * screen that looks like our catalog, and — worse — point `coverUrl` at any host,
 * turning an app launch into a request to a server of someone else's choosing.
 * Everything here is treated as untrusted: fields are type-checked, strings are
 * length-capped, and the cover must be an https(s) URL or nothing.
 */
function sanitizeBook(raw?: string): BookSearchResult | null {
  if (!raw) return null;
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;

  const str = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  const httpUrl = (v: unknown): string | null => {
    const u = str(v, 2048);
    return u && /^https?:\/\//i.test(u) ? u : null;
  };

  const title = str(p.title, 300);
  if (!title) return null;

  return {
    googleBooksId: str(p.googleBooksId, 128) ?? '',
    title,
    authors: Array.isArray(p.authors)
      ? (p.authors.map((a: unknown) => str(a, 200)).filter(Boolean) as string[]).slice(0, 8)
      : [],
    coverUrl: httpUrl(p.coverUrl),
    pageCount: num(p.pageCount),
    durationMinutes: num(p.durationMinutes),
    publishedYear: num(p.publishedYear),
    genres: Array.isArray(p.genres)
      ? (p.genres.map((g: unknown) => str(g, 60)).filter(Boolean) as string[]).slice(0, 8)
      : [],
    description: str(p.description, 8000),
    isbn13: str(p.isbn13, 20),
  };
}

// Catalog book page — what you get when you tap a book you don't own yet.
//
// Before this existed, tapping a cover in Discover pushed you into the add-book
// SEARCH sheet pre-filled with that book's title, so you had to find and pick the
// book you had just picked, and the only thing on offer was "add it or don't". This
// screen answers the actual question ("what is this book?") and keeps adding as an
// action you take once you've decided.
//
// The book arrives as a JSON param rather than an id: every surface that links here
// already holds a complete BookSearchResult (Google's volume response carries the
// description, page count, year and categories), so refetching would only buy a
// spinner. Deep-linking is the tradeoff — quire://book has no id to resolve — and
// nothing links here from outside the app today.
export default function BookPage() {
  const { data, status, from } = useLocalSearchParams<{ data?: string; status?: string; from?: string }>();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  // This screen is reached two ways, and they are presented differently.
  //
  // From add-book (a transparentModal) it arrives as a stacked card that already
  // begins BELOW the status bar, so adding the device's top inset counts that
  // clearance twice and leaves a dead strip above the back button. From
  // Discover / Browse / Author it is a plain full-screen push and needs the
  // whole inset or the button sits under the clock.
  // 16 rather than 0: the card starts below the status bar, but its own top edge
  // still needs the breathing room any screen edge gets — at 6 the button was
  // jammed against it.
  const stacked = from === 'search' || from === 'session_picker';
  const topPad = stacked ? 16 : insets.top + 6;
  const reduce = useReducedMotion();

  const book = useMemo(() => sanitizeBook(data), [data]);

  const [shelf, setShelf] = useState<ReadingStatus>(
    status === 'reading' ? 'reading' : status === 'tbr' ? 'tbr' : 'want'
  );
  const [format, setFormat] = useState<BookFormat>('physical');
  const [ownedBook, setOwnedBook] = useState<UserBook | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<BookSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descOpen, setDescOpen] = useState(false);

  // Re-checked on focus, not just on mount: you can add this book, walk into the
  // library detail, remove it there, and come back — the CTA has to be right.
  useFocusEffect(
    useCallback(() => {
      if (!book) return;
      let alive = true;
      api.getUserBooks()
        .then((list) => alive && setOwnedBook(findOwned(buildOwnedLookup(list), book) ?? null))
        .catch(() => {});
      return () => { alive = false; };
    }, [api, book])
  );

  const onAddPress = () => {
    if (!book || adding) return;
    Haptics.selectionAsync();
    // A backfilled "Finished" needs its month/year, so the read lands in the right
    // period on the stats heatmap rather than today.
    if (shelf === 'finished') {
      setDatePickerOpen(true);
      return;
    }
    performAdd();
  };

  const performAdd = async (finishedISO?: string) => {
    if (!book || adding) return;
    setDatePickerOpen(false);
    setAdding(true);
    setError(null);
    try {
      const result = await api.addBook(book, format);
      // addBook lands everything on "want"; promote it if the reader chose otherwise.
      if (shelf === 'tbr') {
        await api.updateBookStatus(result.id, 'tbr');
      } else if (shelf === 'reading' && result.status !== 'reading') {
        await api.updateBookStatus(result.id, 'reading');
      } else if (shelf === 'finished') {
        await api.updateBookStatus(result.id, 'finished', finishedISO ?? new Date().toISOString());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('book_added', { source: from ?? 'book_page', shelf });
      setAdding(false);
      setOwnedBook({ ...result, status: shelf });
      setAdded(book); // fire the success celebration
    } catch (e: any) {
      setAdding(false);
      setError(e?.message ?? 'Could not add this book. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (!book) {
    return (
      <ScreenBackground>
        <View style={[styles.bar, { paddingTop: topPad }]}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.missing}>
          <Q expression="shrug" size={120} />
          <Text style={[styles.missingTitle, { color: t.text }]}>Book not found</Text>
          <Text style={[styles.missingBody, { color: t.textSec }]}>
            We lost track of which book you tapped. Try searching for it again.
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  const author = book.authors[0];
  const meta = [
    book.pageCount ? `${book.pageCount} pages` : null,
    book.publishedYear ? String(book.publishedYear) : null,
    book.genres[0] ?? null,
  ].filter(Boolean) as string[];
  const description = book.description?.trim();

  return (
    <ScreenBackground>
      <View style={[styles.bar, { paddingTop: topPad }]}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Hero — the same centred cover / meta / title / author stack as the
            library book detail, so an un-owned book and an owned one read as the
            same kind of page. */}
        <Reveal i={0} reduce={reduce}>
          <View style={styles.hero}>
            <View style={[styles.coverShadow, hardShadow(t.mode === 'dark' ? '#000000' : t.border, 4)]}>
              <BookCover url={book.coverUrl} title={book.title} width={COVER_W} />
            </View>
          </View>
        </Reveal>

        <Reveal i={1} reduce={reduce}>
          <View style={styles.titleBlock}>
            {meta.length > 0 ? (
              <View style={styles.metaRow}>
                {meta.map((m, i) => (
                  <View key={m} style={styles.metaItem}>
                    {i > 0 ? <View style={[styles.metaDot, { backgroundColor: t.textTer }]} /> : null}
                    <Text style={[styles.metaText, { color: t.textSec }]}>{m}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={[styles.title, { color: t.text }]}>{book.title}</Text>
            {author ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/author?name=${encodeURIComponent(author)}` as Href);
                }}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel={`About ${author} and their other books`}
                style={({ pressed }) => [styles.authorLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.author, { color: t.accent }]} numberOfLines={2}>
                  {book.authors.join(', ')}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={t.accent} />
              </Pressable>
            ) : null}
          </View>
        </Reveal>

        {book.genres.length > 0 ? (
          <Reveal i={2} reduce={reduce}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {book.genres.slice(0, 5).map((g, i) => {
                const { bg, fg } = GENRE_PALETTE[i % GENRE_PALETTE.length];
                return (
                  <View key={g} style={[styles.chip, { backgroundColor: bg }]}>
                    <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>{g}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </Reveal>
        ) : null}

        {description ? (
          <Reveal i={3} reduce={reduce}>
            <View style={styles.aboutBlock}>
              <Text style={[styles.label, { color: t.textSec }]}>ABOUT</Text>
              <Text style={[styles.about, { color: t.text }]} numberOfLines={descOpen ? undefined : 8}>
                {description}
              </Text>
              {/* Only when there's more to reveal — eight lines of 15px body in this
                  column is ≈420 characters. */}
              {description.length > 420 ? (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setDescOpen((v) => !v); }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: descOpen }}
                  accessibilityLabel={descOpen ? 'Show less of the description' : 'Read the full description'}
                  style={styles.moreRow}
                >
                  <Text style={[styles.moreText, { color: t.accent }]}>{descOpen ? 'READ LESS' : 'READ MORE'}</Text>
                  <Ionicons name={descOpen ? 'chevron-up' : 'chevron-down'} size={13} color={t.accent} />
                </Pressable>
              ) : null}
            </View>
          </Reveal>
        ) : null}
        {/* Add to shelf, or a way into the copy you already have. Deliberately
            BELOW the blurb: this is the decision, and it needs the description
            above it to be an informed one. */}
        <Reveal i={4} reduce={reduce}>
          {ownedBook ? (
            <View style={styles.ownedBlock}>
              <View style={[styles.ownedBanner, { backgroundColor: t.bgSec, borderColor: OWNED_GREEN }]}>
                <Ionicons name="checkmark-circle" size={18} color={OWNED_GREEN} />
                <Text style={[styles.ownedText, { color: OWNED_GREEN }]} numberOfLines={1}>
                  On your shelf · {SHELF_LABEL[ownedBook.status]}
                </Text>
              </View>
              <PressBlock
                onPress={() => router.push(`/(tabs)/library/${ownedBook.id}` as Href)}
                accessibilityLabel="Open in your library"
                style={[styles.cta, { backgroundColor: t.accent, borderColor: INK }]}
              >
                <Ionicons name="library" size={18} color={PALETTE.onAccent} />
                <Text style={styles.ctaText}>OPEN IN LIBRARY</Text>
              </PressBlock>
            </View>
          ) : (
            <View style={styles.addBlock}>
              <Text style={[styles.label, { color: t.textSec }]}>ADD TO</Text>
              <View style={styles.pillRow}>
                {SHELVES.map((s) => (
                  <Pill
                    key={s.key}
                    icon={s.icon}
                    label={s.label}
                    active={s.key === shelf}
                    onPress={() => { Haptics.selectionAsync(); setShelf(s.key); }}
                  />
                ))}
              </View>

              <Text style={[styles.label, { color: t.textSec }]}>FORMAT</Text>
              <View style={styles.pillRow}>
                {FORMATS.map((f) => (
                  <Pill
                    key={f.key}
                    icon={f.icon}
                    label={f.label}
                    active={f.key === format}
                    onPress={() => { Haptics.selectionAsync(); setFormat(f.key); }}
                  />
                ))}
              </View>

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: t.bgSec, borderColor: t.danger }]}>
                  <Ionicons name="alert-circle" size={18} color={t.danger} />
                  <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
                </View>
              ) : null}

              <PressBlock
                onPress={onAddPress}
                disabled={adding}
                accessibilityLabel={`Add ${book.title} to your ${SHELF_LABEL[shelf]}`}
                accessibilityState={{ busy: adding }}
                style={[styles.cta, { backgroundColor: t.accent, borderColor: INK }, adding && styles.ctaBusy]}
              >
                {adding ? (
                  <ActivityIndicator color={PALETTE.onAccent} />
                ) : (
                  <>
                    <Ionicons name={error ? 'refresh' : 'add'} size={20} color={PALETTE.onAccent} />
                    <Text style={styles.ctaText}>
                      {error ? 'TRY AGAIN' : shelf === 'finished' ? 'SET FINISH DATE' : 'ADD TO SHELF'}
                    </Text>
                  </>
                )}
              </PressBlock>
            </View>
          )}
        </Reveal>

      </ScrollView>

      <FinishedDatePicker
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={performAdd}
      />
      {/* Celebration only; the page itself has already flipped to the owned state
          underneath, so dismissing lands on "On your shelf · …". */}
      <BookAddedOverlay book={added} reduce={reduce} accent={t.accent} onDone={() => setAdded(null)} />
    </ScreenBackground>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
    >
      <Ionicons name="chevron-back" size={22} color={t.text} />
    </Pressable>
  );
}

function Pill({
  icon, label, active, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.pill,
        { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? t.accent : t.textSec} />
      <Text style={[styles.pillText, { color: active ? t.accent : t.textSec }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 60).duration(420)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 2 },
  roundBtn: { width: 42, height: 42, borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 18, gap: 18 },

  hero: { alignItems: 'center', paddingTop: 0 },
  // Must match BookCover's own 14px radius — a square shadow box behind a rounded
  // cover shows its corners and reads as a rendering bug.
  coverShadow: { borderRadius: RADIUS.md },
  titleBlock: { alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  metaText: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  title: { fontFamily: FONTS.serifBold, fontSize: 27, lineHeight: 31, textAlign: 'center', marginTop: 2 },
  authorLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 4 },
  author: { fontFamily: FONTS.uiSemiBold, fontSize: 15, textAlign: 'center', textDecorationLine: 'underline' },

  chipScroll: { marginHorizontal: -18 },
  chipRow: { paddingHorizontal: 18, gap: 8, alignItems: 'center' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, ...NO_FONT_PAD },

  addBlock: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, gap: 4, paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH,
    alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontFamily: FONTS.uiSemiBold, fontSize: 12, ...NO_FONT_PAD },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH_THICK,
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH_THICK,
  },
  errorText: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 13, lineHeight: 18 },

  ownedBlock: { gap: 10 },
  ownedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH,
  },
  ownedText: { fontFamily: FONTS.uiSemiBold, fontSize: 13.5 },

  aboutBlock: { gap: 8 },
  about: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 23 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  moreText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 0.8 },

  missing: { ...CENTER_COLUMN, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  missingTitle: { fontFamily: FONTS.uiBold, fontSize: 19 },
  missingBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
