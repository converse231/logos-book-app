import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { HomeData, ReadingSession, StatsData, UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';
import { Card } from '@/components/shared/Card';
import { BookCover } from '@/components/shared/BookCover';
import { StatTile } from '@/components/shared/StatTile';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { XpLevelCard } from '@/components/stats/XpLevelCard';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { coverByUserBook, coversByDate } from '@/lib/profileStats';
import { BadgeGrid } from '@/components/stats/BadgeGrid';
import { AlmostThereBanner } from '@/components/gamification/AlmostThereBanner';
import { RefreshingOverlay, HIDDEN_SPINNER } from '@/components/shared/RefreshingOverlay';

type Tile = { icon: keyof typeof Ionicons.glyphMap; value: string; label: string };

export default function Stats() {
  const t = useTheme();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [home, setHome] = useState<HomeData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [books, setBooks] = useState<UserBook[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null); // tapped calendar day

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      Promise.all([api.getHomeData(), api.getStats(), api.getUserBooks()])
        .then(([h, s, b]) => {
          if (!alive) return;
          setHome(h);
          setStats(s);
          setBooks(b);
        })
        .catch(() => alive && setError(true))
        .finally(() => setRefreshing(false));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  if (error && (!home || !stats || !books)) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!home || !stats || !books) {
    return (
      <ScreenBackground>
        <StatsSkeleton topInset={insets.top + 10} />
      </ScreenBackground>
    );
  }

  const tiles: Tile[] = [
    { icon: 'reader', value: stats.lifetimePages.toLocaleString(), label: 'Pages read' },
    { icon: 'time', value: `${stats.lifetimeHours}h`, label: 'Time read' },
    { icon: 'library', value: `${stats.booksFinished}`, label: 'Books finished' },
    { icon: 'speedometer', value: stats.avgPph != null ? `${stats.avgPph}` : '—', label: 'Avg pages/hr' },
    { icon: 'flame', value: `${stats.currentStreak}`, label: 'Current streak' },
    { icon: 'trophy', value: `${stats.longestStreak}`, label: 'Longest streak' },
  ];
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  const unlocked = stats.badges.filter((b) => b.unlockedAt).length;
  // date → that day's book cover, for the Fable-style reading calendar.
  const coverDates = coversByDate(stats.sessions, coverByUserBook(books));
  // Tapping a calendar day opens that day's sessions.
  const bookById = new Map(books.map((b) => [b.id, b]));
  const daySessions = dayDate ? stats.sessions.filter((s) => s.localDate === dayDate) : [];

  const openSessionDetail = (s: ReadingSession, ub?: UserBook) => {
    setDayDate(null);
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

  const inProgress = stats.badges
    .filter((b) => !b.unlockedAt && b.progressValue > 0 && b.unlockThreshold > 0)
    .sort((a, b) => b.progressValue / b.unlockThreshold - a.progressValue / a.unlockThreshold);
  const closest = inProgress[0];

  // Brand-new account: no reading sessions yet → show a first-run nudge instead
  // of a wall of zeros + an empty heatmap.
  const noActivity = stats.sessions.length === 0;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...HIDDEN_SPINNER} />
        }
      >
        <Text style={[styles.title, { color: t.text }]}>Stats</Text>

        <Reveal i={0} reduce={reduce}>
          <XpLevelCard
            levelName={home.user.levelName}
            level={home.user.level}
            totalXp={home.user.totalXp}
            prevLevelXp={home.prevLevelXp}
            xpToNextLevel={home.xpToNextLevel}
          />
        </Reveal>

        {noActivity ? (
          <Reveal i={1} reduce={reduce}>
            <EmptyStats t={t} onStart={() => router.push('/(tabs)/library' as Href)} />
          </Reveal>
        ) : (
          <>
            <Reveal i={1} reduce={reduce}>
              <View style={styles.bento}>
                {rows.map((row, ri) => (
                  <View key={ri} style={styles.statRow}>
                    {row.map((tile) => (
                      <StatTile key={tile.label} icon={tile.icon} value={tile.value} label={tile.label} />
                    ))}
                  </View>
                ))}
              </View>
            </Reveal>

            <Reveal i={2} reduce={reduce}>
              <View style={styles.calendarSection}>
                <Text style={[styles.calendarLabel, { color: t.textSec }]}>READING ACTIVITY · TAP A DAY</Text>
                <StreakCalendar covers={coverDates} onSelectDate={setDayDate} />
              </View>
            </Reveal>

            <Reveal i={3} reduce={reduce}>
              <Pressable
                onPress={() => router.push('/session/history' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Session history"
                style={({ pressed }) => [styles.historyRow, { backgroundColor: t.bgSec, borderColor: t.border }, pressed && { opacity: 0.75 }]}
              >
                <Ionicons name="time-outline" size={20} color={t.accent} />
                <View style={styles.historyText}>
                  <Text style={[styles.historyTitle, { color: t.text }]}>Session history</Text>
                  <Text style={[styles.historySub, { color: t.textSec }]}>
                    {stats.sessions.length} {stats.sessions.length === 1 ? 'session' : 'sessions'} · review &amp; re-share
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textTer} />
              </Pressable>
            </Reveal>
          </>
        )}

        {closest ? (
          <Reveal i={4} reduce={reduce}>
            <AlmostThereBanner
              label={`${closest.name} · ${closest.progressValue}/${closest.unlockThreshold}`}
              progress={closest.progressValue / closest.unlockThreshold}
              icon={closest.iconName as keyof typeof Ionicons.glyphMap}
            />
          </Reveal>
        ) : null}

        <Reveal i={5} reduce={reduce}>
          <Card padded style={styles.sectionCard}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Achievements</Text>
              <Text style={[styles.cardMeta, { color: t.textSec }]}>
                {unlocked}/{stats.badges.length} earned
              </Text>
            </View>
            <BadgeGrid badges={stats.badges} />
          </Card>
        </Reveal>
      </ScrollView>

      <RefreshingOverlay refreshing={refreshing} top={insets.top + 8} />

      <DaySessionsSheet
        date={dayDate}
        sessions={daySessions}
        bookById={bookById}
        onClose={() => setDayDate(null)}
        onOpen={openSessionDetail}
        t={t}
      />
    </ScreenBackground>
  );
}

// Bottom sheet listing the sessions logged on a tapped calendar day. Each row
// opens the full per-session detail (Strava-style, re-shareable).
function DaySessionsSheet({
  date,
  sessions,
  bookById,
  onClose,
  onOpen,
  t,
}: {
  date: string | null;
  sessions: ReadingSession[];
  bookById: Map<string, UserBook>;
  onClose: () => void;
  onOpen: (s: ReadingSession, ub?: UserBook) => void;
  t: ReturnType<typeof useTheme>;
}) {
  if (!date) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: t.bg, borderColor: t.border }]} onPress={() => {}}>
          <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
          <Text style={[styles.sheetTitle, { color: t.text }]}>{longDayLabel(date)}</Text>
          <Text style={[styles.sheetSub, { color: t.textSec }]}>
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
            {sessions.map((s) => {
              const ub = bookById.get(s.userBookId);
              const isAudio = s.format === 'audiobook';
              const minutes = Math.max(1, Math.round(s.durationSeconds / 60));
              const primary = isAudio
                ? `${s.minutesListened ?? minutes} min listened`
                : `${s.pagesRead ?? 0} ${(s.pagesRead ?? 0) === 1 ? 'page' : 'pages'} · ${minutes} min`;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onOpen(s, ub)}
                  accessibilityRole="button"
                  accessibilityLabel={`${ub?.book.title ?? 'A book'}, ${primary}`}
                  style={({ pressed }) => [styles.dayRow, { borderColor: t.border, backgroundColor: t.bgSec }, pressed && { opacity: 0.75 }]}
                >
                  <View style={[styles.dayCoverFrame, { borderColor: t.border }]}>
                    <BookCover url={ub?.book.coverUrl ?? null} title={ub?.book.title ?? 'Book'} format={s.format} width={38} />
                  </View>
                  <View style={styles.dayRowInfo}>
                    <Text style={[styles.dayRowTitle, { color: t.text }]} numberOfLines={1}>{ub?.book.title ?? 'A book'}</Text>
                    <Text style={[styles.dayRowStats, { color: t.textSec }]} numberOfLines={1}>{primary}</Text>
                  </View>
                  {s.isPersonalBest ? <Ionicons name="trophy" size={14} color={t.gold} /> : null}
                  <Ionicons name="chevron-forward" size={16} color={t.textTer} />
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[styles.sheetCloseBtn, { borderColor: t.border }]}>
            <Text style={[styles.sheetCloseText, { color: t.text }]}>CLOSE</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// 'YYYY-MM-DD' → "Thursday, Oct 3" (local, no timezone shift).
function longDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// Module-level so cards don't remount and replay on any re-render.
function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 70).duration(440)}>{children}</Animated.View>;
}

// First-run state: no sessions yet. Aspirational nudge into the core loop.
function EmptyStats({ t, onStart }: { t: ReturnType<typeof useTheme>; onStart: () => void }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
        <Ionicons name="bar-chart-outline" size={28} color={t.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>No reading sessions yet</Text>
      <Text style={[styles.emptyBody, { color: t.textSec }]}>
        Track your first session to unlock pages read, your reading streak, pace, and the heatmap.
      </Text>
      <PressBlock
        onPress={onStart}
        accessibilityLabel="Start your first session"
        containerStyle={styles.emptyCtaWrap}
        style={[styles.emptyCta, { backgroundColor: t.accent, borderColor: t.border }]}
      >
        <Ionicons name="play" size={18} color={t.onAccent} />
        <Text style={[styles.emptyCtaText, { color: t.onAccent }]}>Start reading</Text>
      </PressBlock>
    </View>
  );
}

// Layout-shaped placeholder matching the real Stats structure.
function StatsSkeleton({ topInset }: { topInset: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      <Skeleton width={120} height={30} />
      <Skeleton width="100%" height={150} radius={22} />
      <View style={styles.statRow}>
        <Skeleton width="48%" height={92} radius={16} />
        <Skeleton width="48%" height={92} radius={16} />
      </View>
      <View style={styles.statRow}>
        <Skeleton width="48%" height={92} radius={16} />
        <Skeleton width="48%" height={92} radius={16} />
      </View>
      <Skeleton width="100%" height={170} radius={22} />
      <Skeleton width="100%" height={190} radius={22} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  title: { fontFamily: FONTS.displayBold, fontSize: 32, lineHeight: 36 },
  bento: { gap: 12 },
  statRow: { flexDirection: 'row', gap: 12 },
  sectionCard: { gap: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: FONTS.uiBold, fontSize: 17 },
  cardMeta: { fontFamily: FONTS.uiMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  calendarSection: { gap: 8 },
  calendarLabel: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginLeft: 4 },

  sheetScrim: { flex: 1, backgroundColor: 'rgba(3,4,6,0.62)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderRadius: 0, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18, gap: 4 },
  sheetHandle: { width: 44, height: 5, borderRadius: 0, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontFamily: FONTS.displayBold, fontSize: 22, letterSpacing: -0.3 },
  sheetSub: { fontFamily: FONTS.mono, fontSize: 12, marginBottom: 8 },
  sheetList: { gap: 10, paddingBottom: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 0, borderWidth: 2 },
  dayCoverFrame: { borderWidth: 2, borderRadius: 0 },
  dayRowInfo: { flex: 1, gap: 3 },
  dayRowTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  dayRowStats: { fontFamily: FONTS.mono, fontSize: 12 },
  sheetCloseBtn: { height: 50, borderRadius: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  sheetCloseText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 0, borderWidth: 2,
  },
  historyText: { flex: 1, gap: 2 },
  historyTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  historySub: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  emptyCard: { alignItems: 'center', gap: 12, padding: 28, borderRadius: 0, borderWidth: 2 },
  emptyIcon: { width: 60, height: 60, borderRadius: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONTS.uiBold, fontSize: 18 },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyCtaWrap: { marginTop: 4 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, height: 48, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK },
  emptyCtaText: { fontFamily: FONTS.uiBold, fontSize: 15 },
});
