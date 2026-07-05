import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { Badge, HomeData, ReadingGoal, StatsData, UserBook, UserProfile } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { LevelNameBadge } from '@/components/shared/LevelNameBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { BadgeGrid } from '@/components/stats/BadgeGrid';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { MonthlyChart } from '@/components/profile/MonthlyChart';
import {
  Scope, finishedBooks, topAuthor, topGenre, finishedChart,
  coverByUserBook, coversByDate, bestStreak, sessionDates,
} from '@/lib/profileStats';

// Profile — identity + bio, XP, lifetime stats, goal, and a scoped reading
// dashboard (most-read author/genre, books-finished chart, cover-calendar,
// achievement stickers). The All-time/This-year toggle re-scopes the summary
// stats + chart; the calendar is its own month-by-month view.
export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [userBooks, setUserBooks] = useState<UserBook[] | null>(null);
  const [scope, setScope] = useState<Scope>('year');
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      Promise.all([
        api.getProfile(),
        api.getHomeData(),
        api.getStats(),
        api.getGoal(new Date().getFullYear()),
        api.getUserBooks(),
      ])
        .then(([p, h, s, g, ub]) => {
          if (!alive) return;
          setProfile(p);
          setHome(h);
          setStats(s);
          setGoal(g);
          setUserBooks(ub);
        })
        .catch(() => alive && setError(true));
      return () => { alive = false; };
    }, [api, nonce])
  );

  // Derived dashboard data (hooks must run every render → null-safe inputs).
  const year = new Date().getFullYear();
  const books = userBooks ?? [];
  const sessions = stats?.sessions ?? [];
  const finished = useMemo(() => finishedBooks(books, scope, year), [userBooks, scope, year]);
  const author = useMemo(() => topAuthor(finished), [finished]);
  const genre = useMemo(() => topGenre(finished), [finished]);
  const chart = useMemo(() => finishedChart(books, scope, year), [userBooks, scope, year]);
  const covers = useMemo(() => coversByDate(sessions, coverByUserBook(books)), [stats, userBooks]);
  const best = useMemo(() => bestStreak(sessionDates(sessions, scope, year)), [stats, scope, year]);

  if (error && (!profile || !home || !stats)) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!profile || !home || !stats || !userBooks) {
    return (
      <ScreenBackground>
        <ProfileSkeleton topInset={insets.top + 6} />
      </ScreenBackground>
    );
  }

  const initials = (profile.displayName ?? 'R').trim().charAt(0).toUpperCase();
  const earnedBadges = stats.badges.filter((b): b is Badge => !!b.unlockedAt);
  const booksFinished = stats.booksFinished;
  const goalPct = goal ? Math.min(1, booksFinished / goal.goalBooks) : 0;
  const scopeWord = scope === 'year' ? 'this year' : 'all time';

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/profile/settings' as Href)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings" style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Ionicons name="settings-outline" size={20} color={t.text} />
          </Pressable>
        </View>

        {/* Identity — social-style header: avatar left, identity beside it */}
        <Reveal i={0} reduce={reduce}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={[styles.avatarText, { color: t.accent }]}>{initials}</Text>
              )}
            </View>
            <View style={styles.identityCol}>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{profile.displayName ?? 'Reader'}</Text>
              {profile.username ? <Text style={[styles.handle, { color: t.textSec }]}>@{profile.username}</Text> : null}
              <LevelNameBadge levelName={profile.levelName} context="home" />
            </View>
          </View>
        </Reveal>

        {profile.bio ? (
          <Reveal i={1} reduce={reduce}>
            <Text style={[styles.bio, { color: t.textSec }]}>{profile.bio}</Text>
          </Reveal>
        ) : null}

        {/* XP progress — compact strip (replaces the heavy level card) */}
        <Reveal i={2} reduce={reduce}>
          <View style={[styles.xpStrip, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <View style={styles.xpTop}>
              <Text style={[styles.xpNum, { color: t.text }]}>
                {profile.totalXp.toLocaleString()}<Text style={[styles.xpUnit, { color: t.textSec }]}> XP</Text>
              </Text>
              <Text style={[styles.xpTo, { color: t.textTer }]}>
                {Math.max(0, home.xpToNextLevel - profile.totalXp).toLocaleString()} TO LEVEL {profile.level + 1}
              </Text>
            </View>
            <ProgressBar
              value={Math.max(0, profile.totalXp - home.prevLevelXp)}
              max={Math.max(1, home.xpToNextLevel - home.prevLevelXp)}
              height={8}
              accent={t.gold}
            />
          </View>
        </Reveal>

        {/* Lifetime stats — all-time */}
        <Reveal i={2} reduce={reduce}>
          <View style={[styles.statsRow, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <BigStat value={stats.lifetimePages.toLocaleString()} label="Pages read" t={t} />
            <View style={[styles.statDivider, { backgroundColor: t.border }]} />
            <BigStat value={`${stats.lifetimeHours}h`} label="Time read" t={t} />
            <View style={[styles.statDivider, { backgroundColor: t.border }]} />
            <BigStat value={`${booksFinished}`} label="Books done" t={t} />
          </View>
        </Reveal>

        {/* Reading goal */}
        {goal ? (
          <Reveal i={3} reduce={reduce}>
            <Pressable onPress={() => { Haptics.selectionAsync(); router.push('/(modals)/goal-edit' as Href); }} accessibilityRole="button" accessibilityLabel="Edit your reading goal">
              <Card padded style={styles.goalCard}>
                <View style={styles.goalHead}>
                  <View style={styles.goalMeta}>
                    <Ionicons name="flag" size={16} color={t.gold} />
                    <Text style={[styles.goalLabel, { color: t.textSec }]}>{new Date().getFullYear()} goal</Text>
                  </View>
                  <Text style={[styles.goalCount, { color: t.text }]}>
                    {booksFinished}
                    <Text style={[styles.goalTotal, { color: t.textTer }]}> / {goal.goalBooks}</Text>
                  </Text>
                  <View style={[styles.editChip, { backgroundColor: t.bgTer }]}>
                    <Ionicons name="pencil-outline" size={13} color={t.textSec} />
                    <Text style={[styles.editLabel, { color: t.textSec }]}>Edit</Text>
                  </View>
                </View>
                <ProgressBar value={booksFinished} max={goal.goalBooks} height={8} accent={t.gold} />
                <Text style={[styles.goalCaption, { color: t.textSec }]}>{Math.round(goalPct * 100)}% of your {goal.year} reading goal</Text>
              </Card>
            </Pressable>
          </Reveal>
        ) : (
          <Reveal i={3} reduce={reduce}>
            <Pressable onPress={() => router.push('/(modals)/goal-edit' as Href)} accessibilityRole="button" accessibilityLabel="Set a reading goal" style={({ pressed }) => [styles.emptyGoal, { borderColor: t.border, backgroundColor: t.bgSec }, pressed && { opacity: 0.7 }]}>
              <Ionicons name="flag-outline" size={22} color={t.accent} />
              <Text style={[styles.emptyGoalText, { color: t.text }]}>Set a reading goal for {new Date().getFullYear()}</Text>
              <Ionicons name="chevron-forward" size={18} color={t.textTer} />
            </Pressable>
          </Reveal>
        )}

        {/* ── Scoped reading dashboard ─────────────────────────────────────── */}
        <Reveal i={4} reduce={reduce}>
          <View style={styles.dashHead}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Your reading</Text>
            <View style={[styles.toggle, { borderColor: t.border, backgroundColor: t.bgSec }]}>
              {(['year', 'all'] as Scope[]).map((s) => {
                const active = scope === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => { Haptics.selectionAsync(); setScope(s); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.toggleBtn, active && { backgroundColor: t.accent }]}
                  >
                    <Text style={[styles.toggleText, { color: active ? t.onAccent : t.textSec }]}>
                      {s === 'year' ? 'This year' : 'All time'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Reveal>

        {/* Most-read author + genre */}
        <Reveal i={5} reduce={reduce}>
          <View style={styles.twoUp}>
            <InfoCard
              icon="person"
              label="MOST-READ AUTHOR"
              value={author?.label ?? '—'}
              sub={author ? `${author.count} book${author.count > 1 ? 's' : ''}` : 'No finished books yet'}
              t={t}
            />
            <InfoCard
              icon="pricetag"
              label="TOP GENRE"
              value={genre?.label ?? '—'}
              sub={genre ? `${genre.count} book${genre.count > 1 ? 's' : ''}` : `Finished ${scopeWord}`}
              t={t}
            />
          </View>
        </Reveal>

        {/* Books finished chart */}
        <Reveal i={6} reduce={reduce}>
          <View style={styles.block}>
            <Text style={[styles.blockLabel, { color: t.textSec }]}>BOOKS FINISHED · {scope === 'year' ? 'BY MONTH' : 'BY YEAR'}</Text>
            <MonthlyChart bars={chart} />
          </View>
        </Reveal>

        {/* Reading streak calendar */}
        <Reveal i={7} reduce={reduce}>
          <View style={styles.block}>
            <View style={styles.calHead}>
              <Text style={[styles.blockLabel, { color: t.textSec }]}>READING STREAK</Text>
              <View style={styles.bestStreak}>
                <Ionicons name="flame" size={14} color={t.ember} />
                <Text style={[styles.bestStreakText, { color: t.text }]}>
                  Best {scopeWord}: {best} day{best === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <StreakCalendar covers={covers} />
          </View>
        </Reveal>

        {/* Achievement stickers */}
        {earnedBadges.length > 0 ? (
          <Reveal i={8} reduce={reduce}>
            <Card padded style={styles.badgeSection}>
              <View style={styles.badgeHead}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Achievements</Text>
                <Pressable onPress={() => router.push('/(tabs)/stats' as Href)} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all achievements">
                  <Text style={[styles.seeAll, { color: t.accent }]}>See all</Text>
                </Pressable>
              </View>
              <BadgeGrid badges={earnedBadges} />
            </Card>
          </Reveal>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 55).duration(420)}>{children}</Animated.View>;
}

function ProfileSkeleton({ topInset }: { topInset: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 40 }]} showsVerticalScrollIndicator={false} scrollEnabled={false}>
      <View style={styles.topBar}>
        <Skeleton width={42} height={42} radius={0} />
        <Skeleton width={42} height={42} radius={0} />
      </View>
      <View style={styles.skelIdentity}>
        <Skeleton width={80} height={80} radius={0} />
        <Skeleton width={170} height={28} />
        <Skeleton width={220} height={14} />
      </View>
      <Skeleton width="100%" height={150} radius={0} />
      <Skeleton width="100%" height={88} radius={0} />
      <Skeleton width="100%" height={150} radius={0} />
      <Skeleton width="100%" height={260} radius={0} />
    </ScrollView>
  );
}

function BigStat({ value, label, t }: { value: string; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.bigStat}>
      <Text style={[styles.bigValue, { color: t.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.bigLabel, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

function InfoCard({ icon, label, value, sub, t }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <Ionicons name={icon} size={18} color={t.accent} />
      <Text style={[styles.infoLabel, { color: t.textTer }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: t.text }]} numberOfLines={2}>{value}</Text>
      <Text style={[styles.infoSub, { color: t.textSec }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  skelIdentity: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  identityCol: { flex: 1, gap: 5, alignItems: 'flex-start' },
  avatar: { width: 76, height: 76, borderRadius: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontFamily: FONTS.uiBold, fontSize: 30 },
  name: { fontFamily: FONTS.displayBold, fontSize: 26, lineHeight: 30 },
  handle: { fontFamily: FONTS.uiMedium, fontSize: 14 },
  bio: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
  xpStrip: { borderRadius: 0, borderWidth: BORDER_WIDTH, padding: 14, gap: 10, ...({ boxShadow: '4px 4px 0px #141414' } as const) },
  xpTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  xpNum: { fontFamily: FONTS.monoBold, fontSize: 24, fontVariant: ['tabular-nums'] },
  xpUnit: { fontFamily: FONTS.monoMedium, fontSize: 14 },
  xpTo: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.3 },

  statsRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 0, borderWidth: BORDER_WIDTH, paddingVertical: 18, paddingHorizontal: 12, ...({ boxShadow: '4px 4px 0px #141414' } as const) },
  bigStat: { flex: 1, alignItems: 'center', gap: 3 },
  bigValue: { fontFamily: FONTS.uiBold, fontSize: 26, fontVariant: ['tabular-nums'] },
  bigLabel: { fontFamily: FONTS.uiMedium, fontSize: 12 },
  statDivider: { width: 1, height: 38, opacity: 0.5 },

  goalCard: { gap: 10 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalLabel: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  goalCount: { flex: 1, fontFamily: FONTS.uiBold, fontSize: 22, fontVariant: ['tabular-nums'], textAlign: 'right' },
  goalTotal: { fontFamily: FONTS.uiSemiBold, fontSize: 16 },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 0 },
  editLabel: { fontFamily: FONTS.uiMedium, fontSize: 11 },
  goalCaption: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  emptyGoal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 0, borderWidth: StyleSheet.hairlineWidth },
  emptyGoalText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 15 },

  dashHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', borderRadius: 0, borderWidth: BORDER_WIDTH, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  toggleText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 0.5 },

  twoUp: { flexDirection: 'row', gap: 12 },
  infoCard: { flex: 1, borderRadius: 0, borderWidth: BORDER_WIDTH, padding: 14, gap: 4, minHeight: 110 },
  infoLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8, marginTop: 2 },
  infoValue: { fontFamily: FONTS.displayBold, fontSize: 18, lineHeight: 22 },
  infoSub: { fontFamily: FONTS.mono, fontSize: 11, marginTop: 'auto' },

  block: { gap: 8 },
  blockLabel: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginLeft: 2 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bestStreak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bestStreakText: { fontFamily: FONTS.monoMedium, fontSize: 12 },

  badgeSection: { gap: 14 },
  badgeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: FONTS.uiBold, fontSize: 17 },
  seeAll: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
});
