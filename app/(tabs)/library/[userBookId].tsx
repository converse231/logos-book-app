import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ReadingStatus, Review, UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { StarRating } from '@/components/library/StarRating';
import { getBookProgress } from '@/components/library/bookProgress';

// A curated set of tinted genre pill colours (bg + fg). Rotates by index so
// consecutive genres always get different hues without needing a genre→colour map.
const GENRE_PALETTE = [
  { bg: 'rgba(99,179,237,0.18)',  fg: '#63B3ED' },  // sky blue   — Fiction / Sci-Fi
  { bg: 'rgba(154,117,244,0.18)', fg: '#9A75F4' },  // violet     — Fantasy / Mystery
  { bg: 'rgba(224,114,158,0.18)', fg: '#E0729E' },  // rose       — Self-Help / Business
  { bg: 'rgba(255,197,61,0.18)', fg: '#D4960A' },  // amber      — History / Biography
  { bg: 'rgba(252,129,100,0.18)', fg: '#E06B4A' },  // coral      — Literary / Cultural
  { bg: 'rgba(99,223,180,0.18)', fg: '#22A37A' },  // teal       — Science / Nature
] as const;

const STATUSES: { key: ReadingStatus; label: string }[] = [
  { key: 'want', label: 'Want' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'dnf', label: 'DNF' },
];

type Tab = 'about' | 'reviews';

// Book detail (blueprint Section 3). Reads user_book + reviews + catalog metadata.
// Editorial hero, a session CTA, shelf status, format-aware progress, and
// About / Reviews tabs surfacing the full books-table data.
export default function BookDetail() {
  const { userBookId } = useLocalSearchParams<{ userBookId: string }>();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const [ub, setUb] = useState<UserBook | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [savingStatus, setSavingStatus] = useState<ReadingStatus | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('about');
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      api.getUserBook(userBookId)
        .then((b) => {
          if (!alive) return;
          setUb(b);
          setFavorite(b.isFavorite);
          api.getReviews(b.book.id).then((r) => alive && setReviews(r));
        })
        .catch(() => alive && setError(true));
      return () => {
        alive = false;
      };
    }, [api, userBookId, nonce])
  );

  if (error && !ub) {
    return (
      <ScreenBackground>
        <View style={[styles.errorTopBar, { paddingTop: insets.top + 6 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
        </View>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!ub) {
    return (
      <ScreenBackground>
        <BookDetailSkeleton topInset={insets.top + 6} coverW={Math.min(210, width * 0.56)} />
      </ScreenBackground>
    );
  }

  const { book, format, status } = ub;
  const prog = getBookProgress(ub);
  const coverW = Math.min(210, width * 0.56);

  const setStatus = async (next: ReadingStatus) => {
    if (next === status || savingStatus) return;
    Haptics.selectionAsync();
    setSavingStatus(next);
    try {
      const updated = await api.updateBookStatus(ub.id, next);
      setUb(updated);
    } finally {
      setSavingStatus(null);
    }
  };

  const length = lengthLabel(ub);
  const ratingCount = reviews.length;
  const ratingAvg = ratingCount > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / ratingCount : 0;
  const meta = [length, book.genres[0]].filter(Boolean) as string[];

  const startSession = () => router.push(`/session/${ub.id}` as Href);
  const writeReview = () =>
    router.push(`/(modals)/review?bookId=${book.id}&title=${encodeURIComponent(book.title)}` as Href);
  const mine = reviews.find((r) => r.userId === 'mock-user-1');

  // Short values become compact half-tiles; long ones (publisher, ISBN) get a
  // full-width tile so nothing truncates. Genres live in the chips above.
  const compactDetails: DetailItem[] = [
    book.publishedYear ? { icon: 'calendar-outline', label: 'Published', value: String(book.publishedYear) } : null,
    length ? { icon: format === 'audiobook' ? 'time-outline' : 'reader-outline', label: 'Length', value: length } : null,
    { icon: formatIcon(format), label: 'Format', value: formatLabel(format) },
    book.language ? { icon: 'globe-outline', label: 'Language', value: languageLabel(book.language) } : null,
  ].filter(Boolean) as DetailItem[];
  const wideDetails: DetailItem[] = [
    book.publisher ? { icon: 'business-outline', label: 'Publisher', value: book.publisher } : null,
    book.isbn13 ? { icon: 'barcode-outline', label: 'ISBN', value: book.isbn13 } : null,
  ].filter(Boolean) as DetailItem[];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <RoundBtn icon="chevron-back" label="Back" onPress={() => router.back()} t={t} />
          <RoundBtn
            icon={favorite ? 'heart' : 'heart-outline'}
            label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            color={favorite ? t.danger : t.text}
            onPress={() => {
              Haptics.selectionAsync();
              setFavorite((f) => !f);
            }}
            t={t}
          />
        </View>

        {/* Hero */}
        <Reveal i={0} reduce={reduce}>
          <View style={styles.hero}>
            <View style={[styles.heroArc, { backgroundColor: t.bgSec }]} pointerEvents="none" />
            <View style={[styles.heroGlow, { backgroundColor: PALETTE.accentAlpha10 }]} pointerEvents="none" />
            <View style={styles.coverShadow}>
              <BookCover url={book.coverUrl} title={book.title} format={format} showFormatBadge width={coverW} />
            </View>
          </View>
        </Reveal>

        {/* Primary action */}
        <Reveal i={1} reduce={reduce}>
          {status !== 'finished' ? (
            <CTAButton
              label={status === 'reading' ? 'Continue reading' : 'Start a session'}
              icon="play"
              onPress={startSession}
            />
          ) : (
            <View style={[styles.finishedRow, { backgroundColor: t.accentMuted }]}>
              <Ionicons name="checkmark-circle" size={20} color={t.accent} />
              <Text style={[styles.finishedText, { color: t.accent }]}>
                Finished{ub.finishedAt ? ` ${relativeDate(ub.finishedAt)}` : ''}
              </Text>
            </View>
          )}
        </Reveal>

        {/* Identity */}
        <Reveal i={2} reduce={reduce}>
          <View style={styles.identity}>
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
            {book.subtitle ? (
              <Text style={[styles.subtitle, { color: t.textSec }]} numberOfLines={2}>
                {book.subtitle}
              </Text>
            ) : null}
            <Text style={[styles.author, { color: t.textSec }]}>{book.authors.join(', ')}</Text>
            {ub.seriesName ? (
              <Text style={[styles.series, { color: t.textTer }]}>
                {ub.seriesName}
                {ub.seriesNumber ? ` · Book ${ub.seriesNumber}` : ''}
              </Text>
            ) : null}
          </View>
        </Reveal>

        {/* Chips: rating + genres */}
        <Reveal i={3} reduce={reduce}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {ratingCount > 0 ? (
              <Pressable
                onPress={() => setTab('reviews')}
                accessibilityRole="button"
                accessibilityLabel={`Rated ${ratingAvg.toFixed(1)} from ${ratingCount} reviews`}
                style={[styles.chip, { backgroundColor: 'rgba(255,197,61,0.14)' }]}
              >
                <Ionicons name="star" size={14} color={t.gold} />
                <Text style={[styles.chipText, { color: t.gold }]}>
                  {ratingAvg.toFixed(1)} ({ratingCount})
                </Text>
              </Pressable>
            ) : null}
            {book.genres.map((g, i) => {
              const { bg, fg } = GENRE_PALETTE[i % GENRE_PALETTE.length];
              return (
                <View key={g} style={[styles.chip, { backgroundColor: bg }]}>
                  <Text style={[styles.chipText, { color: fg }]}>{g}</Text>
                </View>
              );
            })}
          </ScrollView>
        </Reveal>

        {/* Shelf status */}
        <Reveal i={4} reduce={reduce}>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const active = s.key === status;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setStatus(s.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.statusPill,
                    { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
                  ]}
                >
                  {savingStatus === s.key ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : (
                    <Text style={[styles.statusText, { color: active ? t.accent : t.textSec }]}>{s.label}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Reveal>

        {/* Progress */}
        {(status === 'reading' || status === 'dnf') && prog.max > 0 ? (
          <Reveal i={5} reduce={reduce}>
            <View style={styles.progressBlock}>
              <ProgressBar value={prog.pct} max={1} height={8} />
              <Text style={[styles.progressText, { color: t.textTer }]}>
                {prog.isAudio
                  ? `${Math.round(prog.value)} of ${Math.round(prog.max)} min · ${Math.round(prog.pct * 100)}%`
                  : `Page ${prog.value} of ${prog.max} · ${Math.round(prog.pct * 100)}%`}
              </Text>
            </View>
          </Reveal>
        ) : null}

        {/* Tabs */}
        <Reveal i={6} reduce={reduce}>
          <View style={styles.tabs}>
            {(['about', 'reviews'] as Tab[]).map((key) => {
              const active = key === tab;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, { borderBottomColor: active ? t.accent : 'transparent' }]}
                >
                  <Text style={[styles.tabText, { color: active ? t.text : t.textSec }]}>
                    {key === 'about' ? 'About' : `Reviews${ratingCount ? ` (${ratingCount})` : ''}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Reveal>

        {/* Tab content */}
        {tab === 'about' ? (
          <View style={styles.tabBody}>
            {book.description ? (
              <>
                <Text style={[styles.body, { color: t.text }]} numberOfLines={descExpanded ? undefined : 5}>
                  {book.description}
                </Text>
                {book.description.length > 220 ? (
                  <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={6} accessibilityRole="button">
                    <Text style={[styles.moreLink, { color: t.accent }]}>{descExpanded ? 'Show less' : 'Show more'}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            <View style={styles.detailWrap}>
              <View style={styles.detailGrid}>
                {compactDetails.map((d) => (
                  <DetailTile key={d.label} icon={d.icon} label={d.label} value={d.value} t={t} />
                ))}
              </View>
              {wideDetails.map((d) => (
                <DetailTile key={d.label} icon={d.icon} label={d.label} value={d.value} t={t} wide />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.tabBody}>
            {ratingCount > 0 ? (
              <View style={[styles.ratingSummary, { borderBottomColor: t.border }]}>
                <Text style={[styles.ratingBig, { color: t.text }]}>{ratingAvg.toFixed(1)}</Text>
                <View style={styles.ratingSummaryInfo}>
                  <StarRating value={ratingAvg} size={16} />
                  <Text style={[styles.ratingCount, { color: t.textSec }]}>
                    {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.noReviews, { color: t.textSec }]}>
                No reviews yet. Be the first to share what you thought.
              </Text>
            )}

            {reviews.map((r) => (
              <ReviewRow
                key={r.id}
                review={r}
                isMine={r.userId === 'mock-user-1'}
                revealed={revealed.has(r.id)}
                onReveal={() => setRevealed((s) => new Set(s).add(r.id))}
                t={t}
              />
            ))}

            <Pressable
              onPress={writeReview}
              accessibilityRole="button"
              accessibilityLabel={mine ? 'Edit your review' : 'Write a review'}
              style={[styles.writeBtn, { borderColor: t.border }]}
            >
              <Ionicons name="create-outline" size={18} color={t.text} />
              <Text style={[styles.writeText, { color: t.text }]}>{mine ? 'Edit your review' : 'Write a review'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

// ── Module-level pieces (stable identity → no remount/replay on re-render) ──

function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 60).duration(420)}>{children}</Animated.View>;
}

// Layout-shaped placeholder mirroring the detail hero, CTA, title, chips, tabs.
function BookDetailSkeleton({ topInset, coverW }: { topInset: number; coverW: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 36 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      <View style={styles.topBar}>
        <Skeleton width={42} height={42} radius={21} />
        <Skeleton width={42} height={42} radius={21} />
      </View>
      <View style={styles.skelHero}>
        <Skeleton width={coverW} height={coverW / 0.66} radius={10} />
      </View>
      <Skeleton width="100%" height={56} radius={16} />
      <View style={styles.skelIdentity}>
        <Skeleton width={120} height={13} />
        <Skeleton width={240} height={28} />
        <Skeleton width={160} height={15} />
      </View>
      <View style={styles.skelChips}>
        <Skeleton width={90} height={34} radius={999} />
        <Skeleton width={120} height={34} radius={999} />
        <Skeleton width={80} height={34} radius={999} />
      </View>
      <View style={styles.statusRow}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="22%" height={42} radius={12} />
        ))}
      </View>
    </ScrollView>
  );
}

function RoundBtn({
  icon,
  label,
  onPress,
  t,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
    >
      <Ionicons name={icon} size={icon === 'chevron-back' ? 22 : 20} color={color ?? t.text} />
    </Pressable>
  );
}

function CTAButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <View style={styles.ctaWrap}>
      <PressBlock onPress={onPress} accessibilityLabel={label} style={styles.cta}>
        <Ionicons name={icon} size={20} color={PALETTE.onAccent} />
        <Text style={styles.ctaText}>{label.toUpperCase()}</Text>
      </PressBlock>
    </View>
  );
}

type DetailItem = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };

function DetailTile({
  icon,
  label,
  value,
  t,
  wide = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  t: ReturnType<typeof useTheme>;
  wide?: boolean;
}) {
  return (
    <View style={[styles.dTile, { backgroundColor: t.bgSec, borderColor: t.border }, wide ? styles.dTileWide : styles.dTileHalf]}>
      <View style={[styles.dIcon, { backgroundColor: t.bgTer }]}>
        <Ionicons name={icon} size={16} color={t.accent} />
      </View>
      <View style={styles.dText}>
        <Text style={[styles.dValue, { color: t.text }]} numberOfLines={wide ? 1 : 2}>
          {value}
        </Text>
        <Text style={[styles.dLabel, { color: t.textSec }]}>{label}</Text>
      </View>
    </View>
  );
}

function ReviewRow({
  review,
  isMine,
  revealed,
  onReveal,
  t,
}: {
  review: Review;
  isMine: boolean;
  revealed: boolean;
  onReveal: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  const hidden = review.containsSpoilers && !revealed;
  return (
    <View style={[styles.reviewRow, { borderTopColor: t.border }]}>
      <View style={styles.reviewMeta}>
        <StarRating value={review.rating} size={14} />
        <Text style={[styles.reviewName, { color: t.text }]} numberOfLines={1}>
          {isMine ? 'Your review' : review.userName ?? 'Reader'}
        </Text>
        <Text style={[styles.reviewDate, { color: t.textTer }]}>{relativeDate(review.createdAt)}</Text>
      </View>
      {review.body ? (
        hidden ? (
          <Pressable onPress={onReveal} accessibilityRole="button" accessibilityLabel="Reveal spoiler">
            <Text style={[styles.spoiler, { color: t.gold }]}>Contains spoilers. Tap to reveal.</Text>
          </Pressable>
        ) : (
          <Text style={[styles.reviewBody, { color: t.textSec }]}>{review.body}</Text>
        )
      ) : null}
    </View>
  );
}

function lengthLabel(ub: UserBook): string | null {
  if (ub.format === 'audiobook') {
    const m = ub.totalDurationMinutes ?? ub.book.durationMinutes;
    if (!m) return null;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h ${min}m` : `${h}h`;
  }
  const p = ub.pageCountOverride ?? ub.book.pageCount;
  return p ? `${p} pages` : null;
}

function formatLabel(f: string): string {
  return f === 'audiobook' ? 'Audiobook' : f === 'ebook' ? 'E-book' : 'Physical';
}

function formatIcon(f: string): keyof typeof Ionicons.glyphMap {
  return f === 'audiobook' ? 'headset-outline' : f === 'ebook' ? 'tablet-portrait-outline' : 'book-outline';
}

function languageLabel(code: string): string {
  return code === 'en' ? 'English' : code.toUpperCase();
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  errorTopBar: { paddingHorizontal: 18 },
  skelHero: { alignItems: 'center', paddingVertical: 8 },
  skelIdentity: { alignItems: 'center', gap: 8 },
  skelChips: { flexDirection: 'row', gap: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8, marginBottom: 2 },
  heroArc: { position: 'absolute', bottom: 0, left: 28, right: 28, height: 150, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  heroGlow: { position: 'absolute', top: 0, left: 44, right: 44, height: 220, borderRadius: 0, opacity: 0 },
  coverShadow: {
    borderRadius: 0,
    ...({ boxShadow: '4px 4px 0px #141414' } as const),
  },

  ctaWrap: { position: 'relative' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56,
    borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, borderColor: INK, backgroundColor: PALETTE.accent,
  },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 16, letterSpacing: 1, color: PALETTE.onAccent },
  finishedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 0 },
  finishedText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },

  identity: { alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDot: { width: 3, height: 3, borderRadius: 0 },
  metaText: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  title: { fontFamily: FONTS.displayBold, fontSize: 28, lineHeight: 32, textAlign: 'center', marginTop: 4 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center', lineHeight: 19 },
  author: { fontFamily: FONTS.uiSemiBold, fontSize: 15, textAlign: 'center', marginTop: 2 },
  series: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  chipScroll: { marginHorizontal: -18 },
  chipRow: { paddingHorizontal: 18, gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 0 },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },

  statusRow: { flexDirection: 'row', gap: 8 },
  statusPill: { flex: 1, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },

  progressBlock: { gap: 8 },
  progressText: { fontFamily: FONTS.uiMedium, fontSize: 12, fontVariant: ['tabular-nums'] },

  tabs: { flexDirection: 'row', gap: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  tab: { paddingBottom: 10, borderBottomWidth: 2 },
  tabText: { fontFamily: FONTS.uiSemiBold, fontSize: 16 },

  tabBody: { gap: 14, marginTop: -2 },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 22 },
  moreLink: { fontFamily: FONTS.uiSemiBold, fontSize: 13, marginTop: -6 },
  detailWrap: { gap: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  dTile: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 0, borderWidth: StyleSheet.hairlineWidth },
  dTileHalf: { width: '48.5%' },
  dTileWide: { width: '100%' },
  dIcon: { width: 32, height: 32, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  dText: { flex: 1, gap: 1 },
  dValue: { fontFamily: FONTS.uiBold, fontSize: 15 },
  dLabel: { fontFamily: FONTS.uiMedium, fontSize: 11.5 },

  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  ratingBig: { fontFamily: FONTS.uiBold, fontSize: 44, fontVariant: ['tabular-nums'] },
  ratingSummaryInfo: { gap: 4 },
  ratingCount: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  noReviews: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
  reviewRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14, gap: 8 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewName: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  reviewDate: { fontFamily: FONTS.uiRegular, fontSize: 12 },
  reviewBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
  spoiler: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  writeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 0, borderWidth: 1, marginTop: 4 },
  writeText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
});
