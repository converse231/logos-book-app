import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { Badge, HomeData, ReadingGoal, StatsData, UserProfile } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { LevelNameBadge } from '@/components/shared/LevelNameBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { XpLevelCard } from '@/components/stats/XpLevelCard';
import { BadgeGrid } from '@/components/stats/BadgeGrid';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';

// Profile — identity, XP, lifetime stats, earned badges, reading goal.
// Reads: users, stats, goal, badges. All from the mock during the frontend phase.
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
      ])
        .then(([p, h, s, g]) => {
          if (!alive) return;
          setProfile(p);
          setHome(h);
          setStats(s);
          setGoal(g);
        })
        .catch(() => alive && setError(true));
      return () => { alive = false; };
    }, [api, nonce])
  );

  if (error && (!profile || !home || !stats)) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!profile || !home || !stats) {
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

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/profile/settings' as Href)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="settings-outline" size={20} color={t.text} />
          </Pressable>
        </View>

        {/* Identity hero */}
        <Reveal i={0} reduce={reduce}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
              <Text style={[styles.avatarText, { color: t.accent }]}>{initials}</Text>
            </View>
            <Text style={[styles.name, { color: t.text }]}>{profile.displayName ?? 'Reader'}</Text>
            {profile.username ? (
              <Text style={[styles.handle, { color: t.textSec }]}>@{profile.username}</Text>
            ) : null}
            <LevelNameBadge levelName={profile.levelName} context="home" />
          </View>
        </Reveal>

        {/* XP / level card */}
        <Reveal i={1} reduce={reduce}>
          <XpLevelCard
            levelName={profile.levelName}
            level={profile.level}
            totalXp={profile.totalXp}
            prevLevelXp={home.prevLevelXp}
            xpToNextLevel={home.xpToNextLevel}
          />
        </Reveal>

        {/* Lifetime stats — 3 prominent numbers */}
        <Reveal i={2} reduce={reduce}>
          <View style={[styles.statsRow, { backgroundColor: t.bgSec }]}>
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
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(modals)/goal-edit' as Href);
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit your reading goal"
            >
              <Card padded style={styles.goalCard}>
                <View style={styles.goalHead}>
                  <View style={styles.goalMeta}>
                    <Ionicons name="flag" size={16} color={t.gold} />
                    <Text style={[styles.goalLabel, { color: t.textSec }]}>
                      {new Date().getFullYear()} goal
                    </Text>
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
                <Text style={[styles.goalCaption, { color: t.textSec }]}>
                  {Math.round(goalPct * 100)}% of your {goal.year} reading goal
                </Text>
              </Card>
            </Pressable>
          </Reveal>
        ) : (
          <Reveal i={3} reduce={reduce}>
            <Pressable
              onPress={() => router.push('/(modals)/goal-edit' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Set a reading goal"
              style={({ pressed }) => [
                styles.emptyGoal,
                { borderColor: t.border, backgroundColor: t.bgSec },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="flag-outline" size={22} color={t.accent} />
              <Text style={[styles.emptyGoalText, { color: t.text }]}>Set a reading goal for {new Date().getFullYear()}</Text>
              <Ionicons name="chevron-forward" size={18} color={t.textTer} />
            </Pressable>
          </Reveal>
        )}

        {/* Streak */}
        <Reveal i={4} reduce={reduce}>
          <View style={styles.streakRow}>
            <StreakStat
              icon="flame"
              color={t.accent}
              value={`${stats.currentStreak}`}
              label="Current streak"
              t={t}
            />
            <StreakStat
              icon="trophy-outline"
              color={t.gold}
              value={`${stats.longestStreak}`}
              label="Longest streak"
              t={t}
            />
          </View>
        </Reveal>

        {/* Earned badges */}
        {earnedBadges.length > 0 ? (
          <Reveal i={5} reduce={reduce}>
            <Card padded style={styles.badgeSection}>
              <View style={styles.badgeHead}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Achievements</Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/stats' as Href)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all achievements"
                >
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
  return <Animated.View entering={FadeInUp.delay(i * 65).duration(440)}>{children}</Animated.View>;
}

// Layout-shaped placeholder matching the real Profile structure.
function ProfileSkeleton({ topInset }: { topInset: number }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      <View style={styles.topBar}>
        <Skeleton width={42} height={42} radius={21} />
        <Skeleton width={42} height={42} radius={21} />
      </View>
      <View style={styles.skelIdentity}>
        <Skeleton width={80} height={80} radius={40} />
        <Skeleton width={170} height={28} />
        <Skeleton width={110} height={14} />
      </View>
      <Skeleton width="100%" height={150} radius={22} />
      <Skeleton width="100%" height={88} radius={20} />
      <Skeleton width="100%" height={96} radius={22} />
      <View style={styles.streakRow}>
        <Skeleton width="48%" height={96} radius={22} />
        <Skeleton width="48%" height={96} radius={22} />
      </View>
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

function StreakStat({
  icon, color, value, label, t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string;
  label: string;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <Card padded style={styles.streakCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.streakValue, { color: t.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.streakLabel, { color: t.textSec }]} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  skelIdentity: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  identity: { alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.uiBold, fontSize: 32 },
  name: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  handle: { fontFamily: FONTS.uiMedium, fontSize: 15 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    ...({ shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 } as const),
  },
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
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  editLabel: { fontFamily: FONTS.uiMedium, fontSize: 11 },
  goalCaption: { fontFamily: FONTS.uiRegular, fontSize: 13 },

  emptyGoal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  emptyGoalText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 15 },

  streakRow: { flexDirection: 'row', gap: 12 },
  streakCard: { flex: 1, alignItems: 'flex-start', gap: 4 },
  streakValue: { fontFamily: FONTS.uiBold, fontSize: 28, fontVariant: ['tabular-nums'] },
  streakLabel: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  badgeSection: { gap: 14 },
  badgeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: FONTS.uiBold, fontSize: 17 },
  seeAll: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
});
