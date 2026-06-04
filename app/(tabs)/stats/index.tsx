import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { HomeData, StatsData } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { StatTile } from '@/components/shared/StatTile';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { XpLevelCard } from '@/components/stats/XpLevelCard';
import { ReadingHeatmap } from '@/components/stats/ReadingHeatmap';
import { BadgeGrid } from '@/components/stats/BadgeGrid';
import { AlmostThereBanner } from '@/components/gamification/AlmostThereBanner';

type Tile = { icon: keyof typeof Ionicons.glyphMap; value: string; label: string };

export default function Stats() {
  const t = useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [home, setHome] = useState<HomeData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      Promise.all([api.getHomeData(), api.getStats()])
        .then(([h, s]) => {
          if (!alive) return;
          setHome(h);
          setStats(s);
        })
        .catch(() => alive && setError(true));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  if (error && (!home || !stats)) {
    return (
      <ScreenBackground>
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      </ScreenBackground>
    );
  }

  if (!home || !stats) {
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

  const activeDays = stats.heatmapDays.filter((d) => d.minutes > 0).length;
  const unlocked = stats.badges.filter((b) => b.unlockedAt).length;

  const inProgress = stats.badges
    .filter((b) => !b.unlockedAt && b.progressValue > 0 && b.unlockThreshold > 0)
    .sort((a, b) => b.progressValue / b.unlockThreshold - a.progressValue / a.unlockThreshold);
  const closest = inProgress[0];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
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
          <Card padded style={styles.sectionCard}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Reading activity</Text>
              <Text style={[styles.cardMeta, { color: t.textSec }]}>{activeDays} of last 90 days</Text>
            </View>
            <ReadingHeatmap days={stats.heatmapDays} />
          </Card>
        </Reveal>

        {closest ? (
          <Reveal i={3} reduce={reduce}>
            <AlmostThereBanner
              label={`${closest.name} · ${closest.progressValue}/${closest.unlockThreshold}`}
              progress={closest.progressValue / closest.unlockThreshold}
              icon={closest.iconName as keyof typeof Ionicons.glyphMap}
            />
          </Reveal>
        ) : null}

        <Reveal i={4} reduce={reduce}>
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
    </ScreenBackground>
  );
}

// Module-level so cards don't remount and replay on any re-render.
function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 70).duration(440)}>{children}</Animated.View>;
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
});
