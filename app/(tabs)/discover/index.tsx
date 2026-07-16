import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { BookSearchResult, UserProfile } from '@/services/types';
import { fetchAuthorPhoto, toSubject } from '@/lib/bookSearch';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';
import { DiscoverRow } from '@/components/discover/DiscoverRow';

// NYT lists surfaced as carousels (encoded name → display title).
const NYT_LISTS: { name: string; title: string }[] = [
  { name: 'hardcover-fiction', title: 'NYT Bestsellers · Fiction' },
  { name: 'hardcover-nonfiction', title: 'NYT Bestsellers · Nonfiction' },
];

const TOP_CATEGORIES = ['Fiction', 'Mystery', 'Thriller']; // populated with covers
const MORE_CATEGORIES = ['Science Fiction', 'Fantasy', 'Romance', 'Nonfiction', 'Biography', 'History', 'Horror', 'Poetry', 'Self-Help'];
const TOP_AUTHORS = ['Brandon Sanderson', 'Colleen Hoover', 'Stephen King', 'Sally Rooney', 'Haruki Murakami', 'Andy Weir', 'Emily Henry', 'Kazuo Ishiguro'];

// Discover hub — Mood Reader banner + recommendation rows (For You, Trending),
// the top 3 categories as cover carousels (+ a "More categories" toggle for the
// rest), and top authors with Open Library headshots. Catalog data loads ONCE on
// mount (it doesn't change per focus) to keep network calls down.
export default function Discover() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forYou, setForYou] = useState<BookSearchResult[] | null>(null);
  const [trending, setTrending] = useState<BookSearchResult[] | null>(null);
  const [cats, setCats] = useState<Record<string, BookSearchResult[] | null>>(
    Object.fromEntries(TOP_CATEGORIES.map((c) => [c, null]))
  );
  const [authorPhotos, setAuthorPhotos] = useState<Record<string, string | null>>({});
  const [bestsellers, setBestsellers] = useState<Record<string, BookSearchResult[] | null>>(
    Object.fromEntries(NYT_LISTS.map((l) => [l.name, null]))
  );
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getProfile().then((p) => {
      if (!alive) return;
      setProfile(p);
      const genre = p.genrePrefs?.[0] ?? 'fiction';
      api.searchBooks(`subject:${toSubject(genre)}`).then((r) => alive && setForYou(r)).catch(() => alive && setForYou([]));
    }).catch(() => {});
    api.getRecommendedBooks().then((r) => alive && setTrending(r)).catch(() => alive && setTrending([]));
    NYT_LISTS.forEach((l) => {
      api.getBestsellers(l.name)
        .then((r) => alive && setBestsellers((prev) => ({ ...prev, [l.name]: r })))
        .catch(() => alive && setBestsellers((prev) => ({ ...prev, [l.name]: [] })));
    });
    TOP_CATEGORIES.forEach((c) => {
      api.searchBooks(`subject:${toSubject(c)}`).then((r) => alive && setCats((prev) => ({ ...prev, [c]: r }))).catch(() => alive && setCats((prev) => ({ ...prev, [c]: [] })));
    });
    Promise.all(TOP_AUTHORS.map(async (a) => [a, await fetchAuthorPhoto(a)] as const))
      .then((pairs) => alive && setAuthorPhotos(Object.fromEntries(pairs)))
      .catch(() => {});
    return () => { alive = false; };
  }, [api]);

  const topGenre = profile?.genrePrefs?.[0];
  const openBook = (b: BookSearchResult) => {
    Haptics.selectionAsync();
    router.push(`/(modals)/add-book?q=${encodeURIComponent(`${b.title} ${b.authors[0] ?? ''}`.trim())}` as Href);
  };
  const browse = (title: string, q: string) => {
    Haptics.selectionAsync();
    router.push(`/(tabs)/discover/browse?title=${encodeURIComponent(title)}&q=${encodeURIComponent(q)}` as Href);
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: t.text }]}>Discover</Text>

        {/* Mood Reader banner */}
        <View style={styles.padded}>
          <PressBlock onPress={() => router.push('/(tabs)/discover/mood' as Href)} accessibilityLabel="Open Mood Reader" style={[styles.banner, { backgroundColor: t.accent, borderColor: t.border }]}>
            <View style={styles.bannerText}>
              <View style={styles.bannerTag}>
                <Ionicons name="sparkles" size={13} color={t.onAccent} />
                <Text style={[styles.bannerTagText, { color: t.onAccent }]}>MOOD READER</Text>
              </View>
              <Text style={[styles.bannerTitle, { color: t.onAccent }]}>Find your next read by vibe</Text>
              <Text style={[styles.bannerSub, { color: t.onAccent }]}>Pick a mood, swipe through picks →</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={36} color={t.onAccent} />
          </PressBlock>
        </View>

        {/* For You */}
        <DiscoverRow
          title="For you"
          subtitle={topGenre ? `Because you like ${topGenre}` : 'Picks to get you started'}
          books={forYou ?? []}
          loading={forYou === null}
          onTapBook={openBook}
          onSeeAll={() => browse(topGenre ? `For you · ${topGenre}` : 'For you', `subject:${toSubject(topGenre ?? 'fiction')}`)}
        />

        {/* Trending */}
        <DiscoverRow
          title="Trending now"
          subtitle="What readers are picking up"
          books={trending ?? []}
          loading={trending === null}
          onTapBook={openBook}
          onSeeAll={() => browse('Trending', 'subject:fiction bestseller')}
        />

        {/* NYT Bestsellers — cached weekly server-side. Attribution required by ToS. */}
        {NYT_LISTS.map((l) => (
          <DiscoverRow
            key={l.name}
            title={l.title}
            subtitle="Data provided by The New York Times"
            books={bestsellers[l.name] ?? []}
            loading={bestsellers[l.name] === null}
            onTapBook={openBook}
          />
        ))}

        {/* Browse by category — top 3 as carousels, rest behind a toggle */}
        <Text style={[styles.sectionTitle, styles.padded, { color: t.text }]}>Browse by category</Text>
        {TOP_CATEGORIES.map((c) => (
          <DiscoverRow
            key={c}
            title={c}
            books={cats[c] ?? []}
            loading={cats[c] === null}
            onTapBook={openBook}
            onSeeAll={() => browse(c, `subject:${toSubject(c)}`)}
          />
        ))}

        <View style={styles.section}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setMoreOpen((v) => !v); }}
            accessibilityRole="button"
            accessibilityLabel={moreOpen ? 'Hide more categories' : 'Browse more categories'}
            style={({ pressed }) => [styles.moreBtn, { borderColor: t.border, backgroundColor: t.bgSec }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={moreOpen ? 'chevron-up' : 'apps-outline'} size={18} color={t.text} />
            <Text style={[styles.moreBtnText, { color: t.text }]}>{moreOpen ? 'Show fewer' : 'Browse more categories'}</Text>
          </Pressable>
          {moreOpen ? (
            <View style={styles.chips}>
              {MORE_CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => browse(c, `subject:${toSubject(c)}`)} accessibilityRole="button" accessibilityLabel={`Browse ${c}`} style={({ pressed }) => [styles.chip, { backgroundColor: t.bgSec, borderColor: t.border }, pressed && { opacity: 0.7 }]}>
                  <Text style={[styles.chipText, { color: t.text }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Top authors */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Top authors</Text>
          <View style={styles.authorWrap}>
            {TOP_AUTHORS.map((a) => (
              <AuthorCard key={a} name={a} photo={authorPhotos[a]} onPress={() => browse(a, `inauthor:${a}`)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

// Author tile with an Open Library headshot; falls back to the initial when there's
// no photo (404 from `?default=false`) or the image fails to load.
function AuthorCard({ name, photo, onPress }: { name: string; photo: string | null | undefined; onPress: () => void }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photo && !failed;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse books by ${name}`}
      style={({ pressed }) => [styles.authorCard, { backgroundColor: t.bgSec, borderColor: t.border }, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.authorGlyph, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
        {showPhoto ? (
          <Image source={{ uri: photo! }} style={styles.authorPhoto} contentFit="cover" onError={() => setFailed(true)} />
        ) : (
          <Text style={[styles.authorInitial, { color: t.accent }]}>{name.charAt(0)}</Text>
        )}
      </View>
      <Text style={[styles.authorName, { color: t.text }]} numberOfLines={2}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22 },
  padded: { paddingHorizontal: 18 },
  title: { fontFamily: FONTS.displayBold, fontSize: 32, lineHeight: 36, paddingHorizontal: 18 },

  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK },
  bannerText: { flex: 1, gap: 4 },
  bannerTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerTagText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.5, opacity: 0.85 },
  bannerTitle: { fontFamily: FONTS.displayBold, fontSize: 22, lineHeight: 25 },
  bannerSub: { fontFamily: FONTS.uiMedium, fontSize: 13, opacity: 0.9 },

  section: { gap: 12, paddingHorizontal: 18 },
  sectionTitle: { fontFamily: FONTS.displayBold, fontSize: 20, letterSpacing: -0.3 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, borderWidth: BORDER_WIDTH },
  moreBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },

  authorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  authorCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: BORDER_WIDTH },
  authorGlyph: { width: 44, height: 44, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authorPhoto: { width: '100%', height: '100%' },
  authorInitial: { fontFamily: FONTS.displayBold, fontSize: 20 },
  authorName: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 13, lineHeight: 16 },
});
