import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS, NO_FONT_PAD, GENRE_PALETTE, hardShadow } from '@/theme/tokens';
import { coverGrid } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { AuthorProfile, BookSearchResult, UserBook } from '@/services/types';
import { fetchAuthorBooks, fetchAuthorProfile, toSubject } from '@/lib/bookSearch';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { Q } from '@/components/shared/Q';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Reveal } from '@/components/shared/Reveal';

// Author page. Reached from a book's author byline and from the Discover hub's
// top-author tiles; replaces the old bare `inauthor:` grid, which showed a naked
// results list with no sense of who the person was (and the same novel four times).
//
// Everything above the shelf comes from Open Library — the ONLY public source with
// an author entity — and its coverage is wildly uneven. A well-known novelist has a
// portrait, a bio, ratings and links; a mid-list author has a name and a work count
// and nothing else. So this screen is built to LOOK COMPOSED WHEN EMPTY: the hero
// falls back to an ink monogram, absent stats are dropped rather than zeroed, and
// the bio / themes / links blocks simply don't render. The shelf always shows,
// because that's the part the reader came for.
//
// Route: /author?name=… (a query param, not a path segment — author names contain
// slashes and dots often enough that path-encoding is a liability).
export default function Author() {
  const { name: rawName } = useLocalSearchParams<{ name?: string }>();
  const name = (rawName ?? '').trim();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const { columns, cellWidth } = coverGrid(width, 3, 12);

  const [profile, setProfile] = useState<AuthorProfile | null | undefined>(undefined);
  const [books, setBooks] = useState<BookSearchResult[] | null>(null);
  const [shelf, setShelf] = useState<UserBook[]>([]);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [bioOpen, setBioOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      // The profile and the bibliography are independent lookups against different
      // providers — neither should block the other, and a missing profile is not a
      // failed screen (the shelf alone is still worth showing).
      fetchAuthorProfile(name).then((p) => alive && setProfile(p));
      fetchAuthorBooks(name)
        .then((b) => alive && setBooks(b))
        .catch(() => alive && setError(true));
      // Owned copies, so the shelf can mark what the reader already has and route
      // those straight to the book instead of re-adding them.
      api.getUserBooks().then((s) => alive && setShelf(s)).catch(() => {});
      return () => { alive = false; };
    }, [api, name, nonce])
  );

  // Collapse the hero title into the top bar as it scrolls away, so the author's
  // name is never off-screen while browsing a long shelf.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : interpolate(scrollY.value, [64, 116], [0, 1], Extrapolation.CLAMP),
  }));

  // Which of these books are already on the shelf? Matched on title+author rather
  // than id: the catalog id differs between the search result and the stored book.
  const owned = useMemo(() => {
    const surname = name.split(/\s+/).pop()?.toLowerCase() ?? '';
    const m = new Map<string, UserBook>();
    for (const ub of shelf) {
      if (surname && !ub.book.authors.some((a) => a.toLowerCase().includes(surname))) continue;
      m.set(shelfKey(ub.book.title), ub);
    }
    return m;
  }, [shelf, name]);

  const ownedCount = useMemo(
    () => (books ?? []).reduce((n, b) => n + (owned.has(shelfKey(b.title)) ? 1 : 0), 0),
    [books, owned]
  );

  const openBook = (b: BookSearchResult) => {
    Haptics.selectionAsync();
    const ub = owned.get(shelfKey(b.title));
    if (ub) {
      // Already theirs — the library detail has progress, sessions and reviews.
      router.push(`/(tabs)/library/${ub.id}` as Href);
      return;
    }
    router.push({ pathname: '/book', params: { data: JSON.stringify(b), from: 'author' } } as unknown as Href);
  };

  const openLink = (url: string) => {
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => {});
  };

  const browseSubject = (subject: string) => {
    Haptics.selectionAsync();
    router.push(
      `/(tabs)/discover/browse?title=${encodeURIComponent(subject)}&q=${encodeURIComponent(`subject:${toSubject(subject)}`)}` as Href
    );
  };

  // OL's most-held work, resolved against the fetched shelf so the card can link
  // to a real book. Dropped when we can't match it — a dead hero is worse than none.
  const knownFor = useMemo(() => {
    if (!profile?.topWork || !books) return null;
    const key = shelfKey(profile.topWork);
    return books.find((b) => shelfKey(b.title) === key) ?? null;
  }, [profile?.topWork, books]);

  const display = profile?.name ?? name;
  const dates = lifespan(profile ?? null);
  const loadingProfile = profile === undefined;

  // Author facts read as METADATA, not as achievements — so they get the book
  // detail page's quiet dot-separated line rather than a row of tinted blocks.
  // Three big stat tiles gave Open Library trivia the same visual weight as the
  // reader's own streak and XP, which is a lie about what matters here. Anything
  // with no real number behind it is left out, so the line never carries a
  // hollow zero.
  const meta: MetaItem[] = [];
  if (books || profile?.workCount) {
    const n = books ? books.length : profile!.workCount!;
    meta.push({ key: 'books', text: `${compact(n)} ${n === 1 ? 'book' : 'books'}` });
  }
  if (ownedCount > 0) {
    // The one fact about the reader rather than the author — so it takes the accent.
    meta.push({ key: 'owned', text: `${compact(ownedCount)} on your shelf`, color: t.accent, icon: 'bookmark' });
  }
  if (profile?.ratingAverage != null) {
    meta.push({ key: 'rating', text: `${profile.ratingAverage.toFixed(1)} (${compact(profile.ratingCount)})`, icon: 'star' });
  } else if (profile && profile.readerCount > 0) {
    meta.push({ key: 'readers', text: `${compact(profile.readerCount)} readers` });
  }
  if (dates) meta.push({ key: 'dates', text: dates });

  if (!name) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => router.back()} title="No author" message="We didn't get an author name to look up." />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      {/* Compact bar — always present so Back never scrolls away. The title fades
          in only once the hero name has left the viewport. */}
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Animated.Text numberOfLines={1} style={[styles.barTitle, { color: t.text }, barTitleStyle]}>
          {display}
        </Animated.Text>
        {/* Deliberately an empty flexible spacer, NOT a bordered box — the old
            browse header used the round-button style here and rendered a
            mysterious blank button. */}
        <View style={styles.barSpacer} />
      </View>

      {error && !books ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        >
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          {/* One compact block: portrait, name, one metadata line. The name is known
              from the route so it paints immediately — only the portrait and the
              facts have to wait, and skeletoning text we already have would be a
              flash of nothing for no reason. */}
          <Reveal index={0}>
            <View style={styles.hero}>
              {loadingProfile ? (
                <Skeleton width={PORTRAIT} height={PORTRAIT} radius={RADIUS.md} />
              ) : (
                <Portrait name={display} url={profile?.photoUrl ?? null} />
              )}
              <View style={styles.heroText}>
                <Text style={[styles.kicker, { color: t.textTer }]}>AUTHOR</Text>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={3}>{display}</Text>
                {loadingProfile && !books ? (
                  <Skeleton width={150} height={11} style={styles.metaSkeleton} />
                ) : meta.length > 0 ? (
                  <View style={styles.metaRow}>
                    {meta.map((m, i) => (
                      <View key={m.key} style={styles.metaItem}>
                        {i > 0 ? <View style={[styles.metaDot, { backgroundColor: t.textTer }]} /> : null}
                        {m.icon ? <Ionicons name={m.icon} size={11} color={m.color ?? t.textSec} /> : null}
                        <Text style={[styles.metaText, { color: m.color ?? t.textSec }]}>{m.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </Reveal>

          {/* While the profile is in flight, stand in for the blocks that are about
              to arrive. Open Library's search index carries top_work and
              top_subjects for essentially every author it knows, and 4 of 5 have a
              bio, so reserving those three is a good bet — without them the shelf
              paints high and then gets shoved down a screenful when the profile
              lands. Links are genuinely uncommon, so they get no placeholder. */}
          {loadingProfile ? (
            <Reveal index={1}>
              <View style={styles.profileSkeleton}>
                <Skeleton height={62} radius={RADIUS.md} />
                <View style={styles.bioSkeleton}>
                  {BIO_LINES.map((w) => (
                    <Skeleton key={w} width={w} height={13} />
                  ))}
                </View>
                <View style={styles.chipWrap}>
                  {[104, 128, 82, 116].map((w) => (
                    <Skeleton key={w} width={w} height={34} radius={RADIUS.md} />
                  ))}
                </View>
              </View>
            </Reveal>
          ) : null}

          {/* ── Best known for ───────────────────────────────────────────── */}
          {knownFor ? (
            <Reveal index={1}>
              <Pressable
                onPress={() => openBook(knownFor)}
                accessibilityRole="button"
                accessibilityLabel={`Best known for ${knownFor.title}`}
                style={({ pressed }) => [
                  styles.knownRow,
                  { borderColor: t.border, backgroundColor: t.bgSec },
                  pressed && styles.pressed,
                ]}
              >
                <BookCover url={knownFor.coverUrl} title={knownFor.title} width={40} />
                <View style={styles.knownText}>
                  <Text style={[styles.kicker, { color: t.accent }]}>BEST KNOWN FOR</Text>
                  <Text style={[styles.knownTitle, { color: t.text }]} numberOfLines={1}>{knownFor.title}</Text>
                </View>
                {knownFor.publishedYear ? (
                  <Text style={[styles.knownMeta, { color: t.textTer }]}>{knownFor.publishedYear}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={t.textTer} />
              </Pressable>
            </Reveal>
          ) : null}

          {/* ── Bio ──────────────────────────────────────────────────────── */}
          {profile?.bio ? (
            <Reveal index={2}>
              <View style={styles.bioWrap}>
                <Text
                  style={[styles.bio, { color: t.text }]}
                  numberOfLines={bioOpen ? undefined : 6}
                >
                  {profile.bio}
                </Text>
                {/* Only offered when there's actually more to read — a "READ MORE"
                    that expands nothing is worse than no affordance. Six lines of
                    18px serif in this column is ≈280 characters; the threshold is
                    deliberately conservative so it never hides a real overflow. */}
                {profile.bio.length > 280 ? (
                  <Pressable
                    onPress={() => { Haptics.selectionAsync(); setBioOpen((v) => !v); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: bioOpen }}
                    accessibilityLabel={bioOpen ? 'Show less of the biography' : 'Read the full biography'}
                    style={styles.moreRow}
                  >
                    <Text style={[styles.moreText, { color: t.accent }]}>{bioOpen ? 'READ LESS' : 'READ MORE'}</Text>
                    <Ionicons name={bioOpen ? 'chevron-up' : 'chevron-down'} size={13} color={t.accent} />
                  </Pressable>
                ) : null}
                {/* CC BY-SA text needs its source named. */}
                {profile.bioSource ? (
                  <Pressable onPress={() => openLink(profile.bioSource!.url)} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Biography source: ${profile.bioSource.title}`}>
                    <Text style={[styles.credit, { color: t.textTer }]}>
                      Biography from {profile.bioSource.title}, via Open Library
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.credit, { color: t.textTer }]}>Biography via Open Library</Text>
                )}
              </View>
            </Reveal>
          ) : null}

          {/* ── Themes ───────────────────────────────────────────────────── */}
          {profile?.subjects.length ? (
            <Reveal index={3}>
              <View style={styles.block}>
                <Text style={[styles.blockLabel, { color: t.textSec }]}>RECURRING THEMES</Text>
                <View style={styles.chipWrap}>
                  {profile.subjects.map((subject, i) => {
                    const { bg, fg } = GENRE_PALETTE[i % GENRE_PALETTE.length];
                    return (
                      <Pressable
                        key={subject}
                        onPress={() => browseSubject(subject)}
                        accessibilityRole="button"
                        accessibilityLabel={`Browse ${subject}`}
                        style={({ pressed }) => [styles.chip, { backgroundColor: bg }, pressed && styles.pressed]}
                      >
                        <Text style={[styles.chipText, { color: fg }]}>{subject}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Reveal>
          ) : null}

          {/* ── External links ───────────────────────────────────────────── */}
          {profile?.links.length ? (
            <Reveal index={4}>
              <View style={styles.chipWrap}>
                {profile.links.map((l) => (
                  <Pressable
                    key={l.url}
                    onPress={() => openLink(l.url)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${l.title}`}
                    style={({ pressed }) => [
                      styles.linkChip,
                      { borderColor: t.accent, backgroundColor: t.accentMuted },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.linkText, { color: t.accent }]}>{l.title}</Text>
                    <Ionicons name="open-outline" size={13} color={t.accent} />
                  </Pressable>
                ))}
              </View>
            </Reveal>
          ) : null}

          {/* ── Bibliography ─────────────────────────────────────────────── */}
          <View style={styles.shelfBlock}>
            <View style={styles.shelfHeader}>
              <Text style={[styles.shelfTitle, { color: t.text }]}>Books</Text>
              {books ? (
                <Text style={[styles.shelfCount, { color: t.textSec }]}>
                  {books.length}
                  {ownedCount > 0 ? ` · ${ownedCount} yours` : ''}
                </Text>
              ) : null}
            </View>

            {!books ? (
              <ShelfSkeleton cellWidth={cellWidth} columns={columns} />
            ) : books.length === 0 ? (
              <View style={styles.empty}>
                <Q expression="shrug" size={116} />
                <Text style={[styles.emptyTitle, { color: t.text }]}>No books we can show</Text>
                <Text style={[styles.emptyBody, { color: t.textSec }]}>
                  The catalog has nothing filed under {display} right now. Try searching the title directly.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {books.map((b, i) => {
                  const ub = owned.get(shelfKey(b.title));
                  return (
                    <Pressable
                      key={`${b.googleBooksId}-${i}`}
                      onPress={() => openBook(b)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        ub ? `${b.title}, on your shelf` : `${b.title}, add to your library`
                      }
                      style={({ pressed }) => [{ width: cellWidth }, styles.cell, pressed && styles.pressed]}
                    >
                      {/* Plain wrapper — no border/padding, so the cell stays exactly
                          cellWidth and the badge can hang off the cover's corner. */}
                      <View>
                        <BookCover url={b.coverUrl} title={b.title} width={cellWidth} />
                        {ub ? (
                          <View style={[styles.ownedBadge, { backgroundColor: t.accent, borderColor: t.border }]}>
                            <Ionicons name="checkmark" size={13} color={t.onAccent} />
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.cellMeta}>
                        <Text style={[styles.cellTitle, { color: t.text }]} numberOfLines={2}>{b.title}</Text>
                        {b.publishedYear ? (
                          <Text style={[styles.cellYear, { color: t.textTer }]}>{b.publishedYear}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <Text style={[styles.footerCredit, { color: t.textTer }]}>Author data from Open Library</Text>
        </Animated.ScrollView>
      )}
    </ScreenBackground>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

// Portrait, or an ink monogram when Open Library has no photo (the common case).
// The monogram is a real design element rather than a grey circle — same block
// language as the rest of the app, so a photo-less author still reads as finished.
function Portrait({ name, url }: { name: string; url: string | null }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const show = !!url && !failed;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.portrait,
        { backgroundColor: show ? t.bgTer : t.accentMuted, borderColor: t.border },
        // 3px, not the usual 4 — the offset has to stay proportional to a 74dp block.
        hardShadow(t.mode === 'dark' ? '#000000' : t.border, 3),
      ]}
    >
      {show ? (
        <Image
          source={{ uri: url! }}
          style={styles.portraitImg}
          contentFit="cover"
          transition={220}
          onError={() => setFailed(true)}
          accessibilityLabel={`Portrait of ${name}`}
        />
      ) : (
        <Text style={[styles.monogram, { color: t.accent }]} allowFontScaling={false}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

interface MetaItem {
  key: string;
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}


// Structure-matching placeholder. The old author screen's skeleton put six
// `flex: 1/3` cells in a wrapping row, so they all shrank into a single row of
// slivers (the "broken loading" bars); fixed cell widths are what make a wrapped
// skeleton grid hold its shape.
function ShelfSkeleton({ cellWidth, columns }: { cellWidth: number; columns: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: columns * 2 }).map((_, i) => (
        // Same cell + caption boxes as the real grid, so rows land where the
        // placeholders were instead of shifting up when the covers arrive.
        <View key={i} style={[styles.cell, { width: cellWidth }]}>
          <Skeleton width={cellWidth} height={cellWidth / 0.66} radius={RADIUS.md} />
          <View style={styles.cellMeta}>
            <Skeleton width={cellWidth * 0.9} height={11} />
            <Skeleton width={cellWidth * 0.45} height={9} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Match a catalog result to a shelved book by work, ignoring edition subtitles. */
function shelfKey(title: string): string {
  return title.split(/[:(–—]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 8951 → "8.9k". Keeps the stat figures to one line at any cell width. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** OL dates are free text ("20 February 1991", "1935", "c. 1890"). Show the years
 *  only — a full birth date beside a name reads like a form field, and a lifespan
 *  is the thing that actually places a writer in time. */
function lifespan(p: AuthorProfile | null): string | null {
  if (!p) return null;
  const yr = (s: string | null) => s?.match(/\d{4}/)?.[0] ?? null;
  const born = yr(p.birthDate);
  const died = yr(p.deathDate);
  if (born && died) return `${born} – ${died}`;
  if (born) return `b. ${born}`;
  if (died) return `d. ${died}`;
  return null;
}

// Ragged line widths — a placeholder paragraph of three equal bars reads as a
// loading bug rather than as text.
const BIO_LINES = ['100%', '96%', '72%'] as const;

const PORTRAIT = 74;

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 10 },
  roundBtn: { width: 42, height: 42, borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  // Centred between the 42dp back button and a matching spacer, like the other
  // list headers. Small + uppercase: the real page title is the serif hero name,
  // this is only the scrolled-away echo of it.
  barTitle: { flex: 1, fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.3, textAlign: 'center', textTransform: 'uppercase', ...NO_FONT_PAD },
  barSpacer: { width: 42 },

  content: { paddingHorizontal: 18, gap: 18 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitImg: { width: '100%', height: '100%' },
  monogram: { fontFamily: FONTS.serifBold, fontSize: 26, ...NO_FONT_PAD },
  heroText: { flex: 1, gap: 3 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.8 },
  name: { fontFamily: FONTS.serifBold, fontSize: 26, lineHeight: 29, letterSpacing: -0.2 },

  // The book detail page's dot-separated metadata line, reused verbatim.
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  metaText: { fontFamily: FONTS.uiMedium, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  metaSkeleton: { marginTop: 6 },
  // Mirrors the real stack below: known-for row, bio lines, theme chips.
  profileSkeleton: { gap: 16 },
  bioSkeleton: { gap: 9 },

  knownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH,
  },
  knownText: { flex: 1, gap: 2 },
  knownTitle: { fontFamily: FONTS.serifBold, fontSize: 17, lineHeight: 21 },
  knownMeta: { fontFamily: FONTS.mono, fontSize: 11, fontVariant: ['tabular-nums'] },

  bioWrap: { gap: 10 },
  // Fraunces at 18px — the blueprint's "book-ish blurb" tier. A biography is
  // exactly that, and the serif is what makes this page read editorial.
  bio: { fontFamily: FONTS.serifMedium, fontSize: 18, lineHeight: 27 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  moreText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 0.8 },
  credit: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.3, lineHeight: 14 },

  block: { gap: 10 },
  blockLabel: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Borderless tinted pills, exactly as the book detail page renders genres.
  chip: { paddingHorizontal: 14, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, ...NO_FONT_PAD },
  // Links keep a hairline outline — they leave the app, so they shouldn't read as
  // the same kind of thing as an in-app subject filter.
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 34,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH,
  },
  linkText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, ...NO_FONT_PAD },

  shelfBlock: { gap: 14 },
  shelfHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  shelfTitle: { fontFamily: FONTS.serifBold, fontSize: 26, lineHeight: 28 },
  shelfCount: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { gap: 5 },
  // Fixed caption height: two title lines plus the year, so a one-line title
  // doesn't pull its cell short and leave the row ragged.
  cellMeta: { minHeight: 44, gap: 1 },
  ownedBadge: {
    position: 'absolute', top: -7, right: -7, width: 24, height: 24, borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center',
  },
  cellTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 12, lineHeight: 15 },
  cellYear: { fontFamily: FONTS.mono, fontSize: 10, fontVariant: ['tabular-nums'] },

  empty: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, gap: 10 },
  emptyTitle: { fontFamily: FONTS.uiBold, fontSize: 18 },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  footerCredit: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, textAlign: 'center' },

  pressed: { opacity: 0.75 },
});
