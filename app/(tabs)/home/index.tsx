import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW, NO_FONT_PAD } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { HomeData, ReadingSession, Review, StatsData, UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';
import { Card } from '@/components/shared/Card';
import { BookCover } from '@/components/shared/BookCover';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { LevelNameBadge } from '@/components/shared/LevelNameBadge';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { RefreshingOverlay, HIDDEN_SPINNER } from '@/components/shared/RefreshingOverlay';
import { SectionHeader } from '@/components/home/SectionHeader';
import { ChallengeCard, ChallengeCardProps } from '@/components/home/ChallengeCard';
import { ReviewQuoteCard } from '@/components/home/ReviewQuoteCard';
import { ReadTodayCard } from '@/components/home/ReadTodayCard';
import { localDateString } from '@/stores/sessionStore';
import { drainQueue } from '@/lib/sessionQueue';

interface FeaturedReviews {
  book: UserBook;
  reviews: Review[];
}

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [data, setData] = useState<HomeData | null>(null);
  const [shelf, setShelf] = useState<UserBook[] | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [featured, setFeatured] = useState<FeaturedReviews | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      // Flush any sessions captured offline; if some synced, reload so the
      // streak / XP / stats reflect them. (No-op + terminates when the queue is empty.)
      drainQueue(api).then((synced) => {
        if (alive && synced > 0) setNonce((n) => n + 1);
      });
      Promise.all([api.getHomeData(), api.getUserBooks(), api.getStats()])
        .then(([h, s, st]) => {
          if (!alive) return;
          setData(h);
          setShelf(s);
          setStats(st);
          const finished = s.find((b) => b.status === 'finished');
          if (finished) {
            api.getReviews(finished.book.id).then((rv) => {
              if (alive && rv.length) setFeatured({ book: finished, reviews: rv });
            });
          }
        })
        .catch(() => alive && setError(true))
        .finally(() => setRefreshing(false));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  // Pull-to-refresh: re-run the whole load (which also drains the offline queue).
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  if (error && (!data || !shelf || !stats)) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!data || !shelf || !stats) {
    return (
      <ScreenBackground>
        <HomeSkeleton topInset={insets.top + 10} />
      </ScreenBackground>
    );
  }

  const tbrBooks = shelf.filter((b) => b.status === 'tbr');
  const booksFinished = stats.booksFinished;
  const goalPct = data.goal ? Math.min(1, booksFinished / data.goal.goalBooks) : 0;
  const initials = (data.user.displayName ?? 'R').trim().charAt(0).toUpperCase();
  // Daily check-in: every local-date with a session (heatmapDays covers all read
  // days; recentSessions is only the last 7 sessions, so multi-session days there
  // drop earlier read days off the week strip).
  const readDates = new Set(stats.heatmapDays.map((d) => d.date));
  const readToday = readDates.has(localDateString());
  const startActive = () =>
    data.activeBook ? router.push(`/session/${data.activeBook.id}` as Href) : router.push('/(tabs)/library' as Href);

  // Recent sessions preview: last few sessions with their book (resolved from the shelf).
  const bookByUserBookId = new Map(shelf.map((b) => [b.id, b]));
  const recentSessions = data.recentSessions.slice(0, 3);
  const openSession = (s: ReadingSession) => {
    Haptics.selectionAsync();
    const ub = bookByUserBookId.get(s.userBookId);
    router.push({
      pathname: '/session/detail',
      params: {
        sessionId: s.id,
        title: ub?.book.title ?? 'A book',
        cover: ub?.book.coverUrl ?? '',
        format: s.format,
        startedAt: s.startedAt,
        durationSeconds: String(s.durationSeconds),
        pagesRead: s.pagesRead != null ? String(s.pagesRead) : '',
        minutesListened: s.minutesListened != null ? String(s.minutesListened) : '',
        pph: s.pph != null ? String(s.pph) : '',
        isPersonalBest: s.isPersonalBest ? '1' : '',
        xpAwarded: String(s.xpAwarded),
      },
    } as unknown as Href);
  };

  // Challenges — surfaced from real gamification state, most urgent first.
  const challenges: ChallengeCardProps[] = [];
  if (data.comeback) {
    const daysLeft = Math.max(0, Math.ceil((new Date(data.comeback.expiresAt).getTime() - Date.now()) / 86400000));
    challenges.push({
      tone: 'ember',
      icon: 'flash',
      kicker: 'Comeback',
      title: `Restore your ${data.comeback.streakAtBreak}-day streak`,
      progress: data.comeback.sessionsCompleted / 3,
      footer: `${data.comeback.sessionsCompleted} of 3 sessions · ${daysLeft} days left`,
      onPress: () => router.push('/(modals)/comeback' as Href),
    });
  }
  if (!data.comeback) {
    // While a comeback is active the streak is broken, so the "extend streak"
    // card would contradict it — the comeback card above covers the streak.
    challenges.push({
      tone: 'ember',
      icon: 'flame',
      kicker: 'Streak',
      title: data.streak.isAtRisk ? `Save your ${data.streak.currentStreak}-day streak` : `Extend your ${data.streak.currentStreak}-day streak`,
      footer: data.streak.isAtRisk ? 'Ends tonight — read to keep it' : 'Read today to push it further',
      onPress: startActive,
    });
  }
  if (data.almostThere) {
    challenges.push({
      tone: 'lilac',
      icon: 'ribbon',
      kicker: 'Milestone',
      title: data.almostThere.label,
      progress: data.almostThere.progress,
      footer: data.almostThere.daysRemaining ? `${data.almostThere.daysRemaining} days to go` : 'Almost there',
      onPress: startActive,
    });
  }
  if (data.goal) {
    challenges.push({
      tone: 'gold',
      icon: 'flag',
      kicker: `${data.goal.year} goal`,
      title: `${booksFinished} of ${data.goal.goalBooks} books read`,
      progress: goalPct,
      footer: `${Math.round(goalPct * 100)}% of the way there`,
      onPress: () => router.push('/(modals)/goal-edit' as Href),
    });
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...HIDDEN_SPINNER} />
        }
      >
        {/* Header */}
        <Reveal index={0} reduce={reduce}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.push('/(tabs)/profile' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.accent }]}
            >
              {data.user.avatarUrl ? (
                <Image source={{ uri: data.user.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={[styles.avatarText, { color: t.accent }]}>{initials}</Text>
              )}
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.greeting, { color: t.textSec }]}>{timeGreeting()}</Text>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {data.user.displayName ?? 'Reader'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/profile/settings' as Href)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={[styles.iconBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
            >
              <Ionicons name="settings-outline" size={20} color={t.text} />
            </Pressable>
          </View>
        </Reveal>

        {/* At-risk (urgent) */}
        {data.streak.isAtRisk ? (
          <Reveal index={1} reduce={reduce}>
            <Card padded style={styles.atRisk}>
              <Ionicons name="alert-circle" size={22} color={t.gold} />
              <Text style={[styles.atRiskText, { color: t.gold }]}>
                Your {data.streak.currentStreak}-day streak ends tonight. Read to keep it alive.
              </Text>
            </Card>
          </Reveal>
        ) : null}

        {/* 1 — Streak + stats bento */}
        <Reveal index={2} reduce={reduce}>
          <Card padded>
            <View style={styles.firstRow}>
              <View style={[styles.streakCell, { borderColor: t.border, backgroundColor: t.bgTer }]}>
                <Text style={[styles.cellLabel, { color: t.textSec }]}>STREAK</Text>
                {reduce ? (
                  <Ionicons name="flame" size={26} color={data.streak.isAtRisk ? t.gold : t.ember} />
                ) : (
                  <Image
                    source={require('@/assets/fire.webp')}
                    style={styles.streakFlame}
                    autoplay
                    contentFit="contain"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                )}
                <Text style={[styles.streakCount, { color: t.text }]}>{data.streak.currentStreak}</Text>
                <Text style={[styles.streakUnit, { color: t.textSec }]}>
                  {data.streak.currentStreak === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <View style={styles.statsCell}>
                <View style={styles.statsHead}>
                  <Text style={[styles.statsTitle, { color: t.text }]}>Your reading</Text>
                  <Pressable
                    onPress={() => router.push('/(tabs)/stats' as Href)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="All stats"
                    style={styles.statsLink}
                  >
                    <Text style={[styles.statsLinkText, { color: t.accent }]}>All stats</Text>
                    <Ionicons name="chevron-forward" size={13} color={t.accent} />
                  </Pressable>
                </View>
                <View style={styles.statsRow}>
                  <HomeStat value={stats.lifetimePages.toLocaleString()} label="pages" t={t} />
                  <HomeStat value={`${stats.lifetimeHours}h`} label="read" t={t} />
                  <HomeStat value={`${stats.booksFinished}`} label="books" t={t} />
                </View>
              </View>
            </View>

            {data.almostThere ? (
              <View style={[styles.milestone, { borderTopColor: t.border }]}>
                <View style={styles.milestoneHead}>
                  <Ionicons name="ribbon" size={16} color={t.accent} />
                  <Text style={[styles.milestoneText, { color: t.text }]}>{data.almostThere.label}</Text>
                </View>
                <ProgressBar value={data.almostThere.progress} max={1} height={8} />
              </View>
            ) : null}
          </Card>
        </Reveal>

        {/* Daily check-in — "I read today" streak saver */}
        <Reveal index={3} reduce={reduce}>
          <ReadTodayCard
            readDates={readDates}
            readToday={readToday}
            activeBook={data.activeBook}
            onLog={() => router.push('/(modals)/read-today' as Href)}
          />
        </Reveal>

        {/* 2 — Shelf Builder (level / XP) */}
        <Reveal index={4} reduce={reduce}>
          <Card padded style={styles.levelCard}>
            <LevelNameBadge levelName={data.user.levelName} context="home" />
            <View style={styles.xpWrap}>
              <ProgressBar
                value={data.user.totalXp - data.prevLevelXp}
                max={Math.max(1, data.xpToNextLevel - data.prevLevelXp)}
                height={6}
                accent={PALETTE.gold}
              />
              <Text style={[styles.xpText, { color: t.textSec }]}>
                {data.user.totalXp.toLocaleString()} XP · Level {data.user.level}
              </Text>
            </View>
          </Card>
        </Reveal>

        {/* 3 — Continue reading */}
        <Reveal index={4} reduce={reduce}>
          {data.activeBook ? (
            <Card padded>
              <Text style={[styles.kicker, { color: t.textSec }]}>CONTINUE READING</Text>
              <View style={styles.bookRow}>
                <BookCover
                  url={data.activeBook.book.coverUrl}
                  title={data.activeBook.book.title}
                  format={data.activeBook.format}
                  showFormatBadge
                  width={62}
                />
                <View style={styles.bookInfo}>
                  <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={2}>
                    {data.activeBook.book.title}
                  </Text>
                  <Text style={[styles.bookAuthor, { color: t.textSec }]} numberOfLines={1}>
                    {data.activeBook.book.authors.join(', ')}
                  </Text>
                  <View style={styles.bookProgress}>
                    <ProgressBar
                      value={data.activeBook.currentPage}
                      max={data.activeBook.book.pageCount ?? 1}
                      height={6}
                    />
                    <Text style={[styles.pageText, { color: t.textTer }]}>
                      page {data.activeBook.currentPage}
                      {data.activeBook.book.pageCount ? ` of ${data.activeBook.book.pageCount}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
              <StartButton onPress={() => router.push(`/session/${data.activeBook!.id}` as Href)} />
            </Card>
          ) : (
            <Card padded style={styles.emptyActive}>
              <Text style={[styles.emptyText, { color: t.textSec }]}>
                No active book. Add one from your library to start a session.
              </Text>
              <PressBlock
                onPress={() => router.push('/(modals)/add-book' as Href)}
                accessibilityLabel="Add a book"
                style={[styles.emptyCta, { backgroundColor: t.accent, borderColor: t.border }]}
              >
                <Ionicons name="add" size={18} color={t.onAccent} />
                <Text style={[styles.emptyCtaText, { color: t.onAccent }]}>Add a book</Text>
              </PressBlock>
            </Card>
          )}
        </Reveal>

        {/* 4 — Up next (TBR) */}
        <Reveal index={5} reduce={reduce}>
          <View style={styles.section}>
            <SectionHeader
              title="Up next"
              actionLabel={tbrBooks.length > 0 ? 'See all' : undefined}
              onAction={tbrBooks.length > 0 ? () => router.push('/(tabs)/library/tbr' as Href) : undefined}
            />
            <Carousel>
              {tbrBooks.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/(tabs)/library/${b.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={b.book.title}
                  style={({ pressed }) => [styles.tbrItem, pressed && styles.pressed]}
                >
                  <BookCover url={b.book.coverUrl} title={b.book.title} format={b.format} width={96} />
                  <Text style={[styles.tbrTitle, { color: t.text }]} numberOfLines={1}>
                    {b.book.title}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => router.push('/(modals)/add-book?status=tbr' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Add a book to your list"
                style={({ pressed }) => [styles.addTile, { borderColor: t.border }, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={26} color={t.accent} />
                <Text style={[styles.addTileText, { color: t.textSec }]}>Add a book</Text>
              </Pressable>
            </Carousel>
          </View>
        </Reveal>

        {/* 5 — Recent sessions */}
        {recentSessions.length > 0 ? (
          <Reveal index={6} reduce={reduce}>
            <View style={styles.section}>
              <SectionHeader
                title="Recent sessions"
                actionLabel="See all"
                onAction={() => router.push('/session/history' as Href)}
              />
              <View style={styles.sessionList}>
                {recentSessions.map((s) => (
                  <RecentSessionRow
                    key={s.id}
                    session={s}
                    book={bookByUserBookId.get(s.userBookId)}
                    onPress={() => openSession(s)}
                    t={t}
                  />
                ))}
              </View>
            </View>
          </Reveal>
        ) : null}

        {/* 6 — Reviews */}
        {featured ? (
          <Reveal index={7} reduce={reduce}>
            <View style={styles.section}>
              <SectionHeader
                title="What readers are saying"
                actionLabel="Read more"
                onAction={() => router.push(`/(tabs)/library/${featured.book.id}` as Href)}
              />
              <Carousel>
                {featured.reviews.slice(0, 4).map((r) => (
                  <ReviewQuoteCard
                    key={r.id}
                    bookTitle={featured.book.book.title}
                    coverUrl={featured.book.book.coverUrl}
                    format={featured.book.format}
                    rating={r.rating}
                    body={r.body ?? ''}
                    author={r.userName ?? 'A reader'}
                    onPress={() => router.push(`/(tabs)/library/${featured.book.id}` as Href)}
                  />
                ))}
              </Carousel>
            </View>
          </Reveal>
        ) : null}

        {/* 7 — Challenges */}
        <Reveal index={8} reduce={reduce}>
          <View style={styles.section}>
            <SectionHeader title="Challenges" />
            <Carousel>
              {challenges.map((c, i) => (
                <ChallengeCard key={i} {...c} />
              ))}
            </Carousel>
          </View>
        </Reveal>
      </ScrollView>
      <RefreshingOverlay refreshing={refreshing} top={insets.top + 8} />
    </ScreenBackground>
  );
}

// Module-level so cards don't remount (and reload covers) on focus refetches.
function Reveal({ index, reduce, children }: { index: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(index * 70).duration(440)}>{children}</Animated.View>;
}

function HomeStat({ value, label, t }: { value: string; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.homeStatCol}>
      <Text style={[styles.homeStatValue, { color: t.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.homeStatLabel, { color: t.textSec }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Compact recent-session row for the home preview (taps into the session detail).
function RecentSessionRow({
  session,
  book,
  onPress,
  t,
}: {
  session: ReadingSession;
  book?: UserBook;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  const isAudio = session.format === 'audiobook';
  const minutes = Math.max(1, Math.round(session.durationSeconds / 60));
  const primary = isAudio
    ? `${session.minutesListened ?? minutes} min listened`
    : `${session.pagesRead ?? 0} ${(session.pagesRead ?? 0) === 1 ? 'page' : 'pages'} · ${minutes} min`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book?.book.title ?? 'A book'}, ${primary}`}
      style={({ pressed }) => [styles.sessionRow, { borderColor: t.border, backgroundColor: t.bgSec }, pressed && styles.pressed]}
    >
      <View style={[styles.sessionCoverFrame, { borderColor: t.border }]}>
        <BookCover url={book?.book.coverUrl ?? null} title={book?.book.title ?? 'Book'} format={session.format} width={34} />
      </View>
      <View style={styles.sessionInfo}>
        <Text style={[styles.sessionTitle, { color: t.text }]} numberOfLines={1}>{book?.book.title ?? 'A book'}</Text>
        <Text style={[styles.sessionStats, { color: t.textSec }]} numberOfLines={1}>{primary}</Text>
      </View>
      {session.isPersonalBest ? <Ionicons name="trophy" size={14} color={t.gold} /> : null}
      <Ionicons name="chevron-forward" size={16} color={t.textTer} />
    </Pressable>
  );
}

// Edge-to-edge horizontal scroller that aligns its first item with the page
// gutter while letting cards bleed off the right edge.
function Carousel({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.carousel}
      contentContainerStyle={styles.carouselContent}
    >
      {children}
    </ScrollView>
  );
}

function StartButton({ onPress }: { onPress: () => void }) {
  return (
    <PressBlock onPress={onPress} accessibilityLabel="Start a reading session" containerStyle={styles.startBtnSpacing} style={styles.startBtn}>
      <Ionicons name="play" size={20} color={PALETTE.onAccent} />
      <Text style={styles.startBtnText}>START READING</Text>
    </PressBlock>
  );
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Layout-shaped loading placeholder — reserves the real screen's structure so
// there's no jump when data arrives (skill: progressive-loading / content-jumping).
function HomeSkeleton({ topInset }: { topInset: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      <View style={styles.header}>
        <Skeleton width={46} height={46} radius={14} />
        <View style={styles.skelHeaderText}>
          <Skeleton width={90} height={12} />
          <Skeleton width={150} height={22} />
        </View>
        <Skeleton width={42} height={42} radius={14} />
      </View>
      <Skeleton width="100%" height={150} radius={22} />
      <Skeleton width="100%" height={84} radius={22} />
      <Skeleton width="100%" height={196} radius={22} />
      <Skeleton width={150} height={24} />
      <View style={styles.skelRow}>
        <Skeleton width={172} height={150} radius={22} />
        <Skeleton width={172} height={150} radius={22} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 18 },
  skelHeaderText: { flex: 1, gap: 6 },
  skelRow: { flexDirection: 'row', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontFamily: FONTS.uiBold, fontSize: 19 },
  headerText: { flex: 1, gap: 1 },
  greeting: { fontFamily: FONTS.uiSemiBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  name: { fontFamily: FONTS.serif, fontSize: 33, lineHeight: 37 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  atRisk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  atRiskText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14, lineHeight: 19 },

  // Streak + stats bento
  firstRow: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  streakCell: {
    width: 92,
    borderWidth: BORDER_WIDTH,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...SHADOW.sm,
  },
  cellLabel: { fontFamily: FONTS.uiBold, fontSize: 10, letterSpacing: 1, marginBottom: 2 },
  streakFlame: { width: 32, height: 32 },
  streakCount: { fontFamily: FONTS.uiBold, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginTop: 2 },
  streakUnit: { fontFamily: FONTS.uiMedium, fontSize: 12 },
  statsCell: { flex: 1, justifyContent: 'center', gap: 14 },
  statsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  statsLink: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  statsLinkText: { fontFamily: FONTS.uiSemiBold, fontSize: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  homeStatCol: { flex: 1, gap: 2 },
  homeStatValue: { fontFamily: FONTS.uiBold, fontSize: 20, fontVariant: ['tabular-nums'] },
  homeStatLabel: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  milestone: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 14, gap: 10 },
  milestoneHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  milestoneText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14 },

  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  xpWrap: { flex: 1, gap: 5 },
  xpText: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  kicker: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginBottom: 12 },
  bookRow: { flexDirection: 'row', gap: 14 },
  bookInfo: { flex: 1, gap: 3, justifyContent: 'center' },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 17, lineHeight: 22 },
  bookAuthor: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  bookProgress: { gap: 5, marginTop: 8 },
  pageText: { fontFamily: FONTS.uiMedium, fontSize: 12, fontVariant: ['tabular-nums'] },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH_THICK,
    borderColor: INK,
    backgroundColor: PALETTE.accent,
  },
  startBtnSpacing: { marginTop: 16 },
  startBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  emptyActive: { gap: 14, alignItems: 'center' },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, height: 46, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK },
  emptyCtaText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },

  section: { gap: 14 },
  sessionList: { gap: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 2 },
  sessionCoverFrame: { borderWidth: 2, borderRadius: 14 },
  sessionInfo: { flex: 1, gap: 2 },
  sessionTitle: { fontFamily: FONTS.uiBold, fontSize: 14 },
  sessionStats: { fontFamily: FONTS.mono, fontSize: 11 },
  carousel: { marginHorizontal: -18 },
  carouselContent: { paddingHorizontal: 18, gap: 12 },
  tbrItem: { width: 96, gap: 6 },
  pressed: { opacity: 0.8 },
  tbrTitle: { fontFamily: FONTS.uiMedium, fontSize: 12 },
  addTile: {
    width: 96,
    height: 96 / 0.66,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addTileText: { fontFamily: FONTS.uiMedium, fontSize: 12 },
});
