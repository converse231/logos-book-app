import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, type ThemeTokens } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useSessionStore } from '@/stores/sessionStore';
import { CountUp } from '@/components/onboarding/CountUp';
import { Confetti } from '@/components/shared/Confetti';
import { Card } from '@/components/shared/Card';
import { PphCounter } from '@/components/session/PphCounter';
import { ReadingInsightCard } from '@/components/session/ReadingInsightCard';
import { BookCover } from '@/components/shared/BookCover';

// The Duolingo moment (blueprint Section 5 timeline). Reads the authoritative
// completeSession result from the store and reveals the result in a stagger:
// an animated badge, a glowing hero card with the headline stat + supporting
// metrics, then a two-up reward row (streak + XP). Confetti fires from two side
// cannons + a centre pop (bigger for a personal best). The variable-reward
// insight slides up after ~2s if the server granted one. Reduced-motion gated.
export default function SessionComplete() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const result = useSessionStore((s) => s.lastResult);
  const active = useSessionStore((s) => s.active);
  const clearResult = useSessionStore((s) => s.clearResult);
  const endSession = useSessionStore((s) => s.endSession);

  const [showInsight, setShowInsight] = useState(false);
  const [fireConfetti, setFireConfetti] = useState(false);

  useEffect(() => {
    if (!result) {
      router.replace('/(tabs)/home' as Href);
      return;
    }
    const c = setTimeout(() => setFireConfetti(true), 150);
    // A streak milestone escalates into its own celebration on top of this one.
    const m = result.milestoneVariant
      ? setTimeout(
          () => router.push(`/(modals)/milestone/${result.milestoneVariant}?count=${result.streak.current}` as Href),
          650
        )
      : null;
    // The insight only slides up on a non-milestone session (mock already gates this).
    const i = result.insight && !result.milestoneVariant ? setTimeout(() => setShowInsight(true), 2000) : null;
    return () => {
      clearTimeout(c);
      if (m) clearTimeout(m);
      if (i) clearTimeout(i);
    };
  }, [result, router]);

  if (!result) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const isAudio = active?.format === 'audiobook';
  const minutes = Math.max(1, Math.round(result.durationSeconds / 60));
  const pages = result.pagesRead ?? 0;
  const isPB = result.isPersonalBest;
  const d = (n: number) => (reduce ? 0 : n);

  const heroValue = isAudio ? minutes : pages;
  const heroLabel = isAudio ? 'minutes listened' : pages === 1 ? 'page read' : 'pages read';

  // Supporting metrics inside the hero card (the headline stat lives above them).
  const metricNodes: React.ReactNode[] = [];
  if (!isAudio) {
    metricNodes.push(<Metric key="min" value={`${minutes}`} label={minutes === 1 ? 'minute' : 'minutes'} color={t.text} sub={t.textSec} />);
    metricNodes.push(
      <View key="pph" style={styles.metricCol}>
        <PphCounter pagesRead={pages} elapsedSeconds={result.durationSeconds} />
      </View>
    );
  }
  if (isPB) {
    metricNodes.push(
      <View key="best" style={styles.metricCol}>
        <Ionicons name="trophy" size={24} color={t.gold} />
        <Text style={[styles.metricLabel, { color: t.gold }]}>best</Text>
      </View>
    );
  }

  const finish = () => {
    clearResult();
    endSession();
    router.replace('/(tabs)/home' as Href);
  };
  const share = () => router.push('/(modals)/share-card' as Href);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <Confetti fire={fireConfetti} particleCount={isPB ? 120 : 80} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal d={d(0)} reduce={reduce}>
          <CheckBadge isPB={isPB} reduce={reduce} t={t} />
        </Reveal>

        <Reveal d={d(110)} reduce={reduce}>
          <Text style={[styles.title, { color: t.text }]}>{isPB ? 'Personal best' : 'Session complete'}</Text>
        </Reveal>

        {/* Book context — grounds the celebration in what was just read */}
        {active?.bookTitle ? (
          <Reveal d={d(170)} reduce={reduce}>
            <View style={styles.bookRow}>
              <BookCover url={active.coverUrl} title={active.bookTitle} format={active.format} width={24} />
              <Text style={[styles.bookCtx, { color: t.textSec }]} numberOfLines={1}>
                {active.bookTitle}
              </Text>
            </View>
          </Reveal>
        ) : null}

        {/* Hero card — headline stat + supporting metrics in one elevated surface */}
        <Reveal d={d(250)} reduce={reduce}>
          <Card glow padded style={styles.heroCard}>
            <CountUp to={heroValue} style={[styles.heroNum, { color: t.text }]} />
            <Text style={[styles.heroLabel, { color: t.textSec }]}>{heroLabel}</Text>
            {metricNodes.length > 0 ? (
              <View style={[styles.heroMetrics, { borderTopColor: t.border }]}>
                {metricNodes.map((node, i) => (
                  <Fragment key={i}>
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: t.border }]} /> : null}
                    {node}
                  </Fragment>
                ))}
              </View>
            ) : null}
          </Card>
        </Reveal>

        {/* Reward row — streak + XP side by side instead of a loose stack */}
        <Reveal d={d(380)} reduce={reduce}>
          <View style={styles.rewardRow}>
            {result.streak.incremented ? (
              <RewardTile tone="emerald" icon="flame" label="day streak" badge="+1" t={t}>
                <Text style={[styles.rewardValue, { color: t.accent }]}>{result.streak.current}</Text>
              </RewardTile>
            ) : null}
            <RewardTile tone="gold" icon="sparkles" label="XP earned" t={t}>
              <Text style={[styles.rewardValue, { color: t.gold }]}>+</Text>
              <CountUp to={result.xpGained} style={[styles.rewardValue, { color: t.gold }]} />
            </RewardTile>
          </View>
        </Reveal>

        {/* Badges */}
        {result.newBadges.length > 0 ? (
          <Reveal d={d(500)} reduce={reduce}>
            <View style={styles.badges}>
              {result.newBadges.map((b) => (
                <View key={b.id} style={[styles.badge, { backgroundColor: t.bgSec, borderColor: t.gold }]}>
                  <Ionicons name="ribbon" size={18} color={t.gold} />
                  <Text style={[styles.badgeText, { color: t.text }]}>{b.name}</Text>
                </View>
              ))}
            </View>
          </Reveal>
        ) : null}
      </ScrollView>

      {/* Actions */}
      <Animated.View
        entering={reduce ? undefined : FadeIn.delay(d(620))}
        style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          onPress={share}
          accessibilityRole="button"
          accessibilityLabel="Share your reading card"
          style={[styles.shareBtn, { backgroundColor: t.accent }]}
        >
          <Ionicons name="share-social" size={20} color={PALETTE.onAccent} />
          <Text style={styles.shareBtnText}>Share your card</Text>
        </Pressable>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Done" style={styles.doneBtn}>
          <Text style={[styles.doneText, { color: t.textSec }]}>Done</Text>
        </Pressable>
      </Animated.View>

      {/* Variable-reward insight */}
      {showInsight && result.insight ? (
        <ReadingInsightCard
          insight={{ id: result.insight.id, type: result.insight.insightType, text: result.insight.insightText }}
          onShare={(id) => {
            api.markInsightShared(id);
            share();
          }}
          onSave={(id) => api.markInsightShared(id)}
          onAutoDismiss={() => setShowInsight(false)}
        />
      ) : null}
    </View>
  );
}

// Module-level so confetti / insight state changes don't remount these and
// replay every entrance + the count-ups (the old inline-component double-fire).
function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(440)}>{children}</Animated.View>;
}

function CheckBadge({ isPB, reduce, t }: { isPB: boolean; reduce: boolean; t: ThemeTokens }) {
  const scale = useSharedValue(reduce ? 1 : 0.4);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(120, withSpring(1, { damping: 10, stiffness: 150 }));
  }, [reduce, scale]);
  return (
    <Animated.View
      style={[styles.checkCircle, { backgroundColor: isPB ? 'rgba(255,197,61,0.16)' : 'rgba(61,123,255,0.14)' }, style]}
    >
      <Ionicons name={isPB ? 'trophy' : 'checkmark'} size={42} color={isPB ? t.gold : t.accent} />
    </Animated.View>
  );
}

function Metric({ value, label, color, sub }: { value: string; label: string; color: string; sub: string }) {
  return (
    <View style={styles.metricCol}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: sub }]}>{label}</Text>
    </View>
  );
}

function RewardTile({
  tone,
  icon,
  label,
  t,
  badge,
  children,
}: {
  tone: 'emerald' | 'gold';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  t: ThemeTokens;
  badge?: string;
  children: React.ReactNode;
}) {
  const color = tone === 'gold' ? t.gold : t.accent;
  const tint = tone === 'gold' ? 'rgba(255,197,61,0.12)' : 'rgba(61,123,255,0.12)';
  return (
    <View style={[styles.rewardTile, { backgroundColor: tint }]}>
      {badge ? (
        <View style={[styles.rewardBadge, { backgroundColor: color }]}>
          <Text style={styles.rewardBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={icon} size={22} color={color} />
      <View style={styles.rewardValueRow}>{children}</View>
      <Text style={[styles.rewardLabel, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 16 },
  checkCircle: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.displayBold, fontSize: 30, textAlign: 'center' },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 260 },
  bookCtx: { fontFamily: FONTS.uiMedium, fontSize: 14, flexShrink: 1 },

  heroCard: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 22 },
  heroNum: { fontFamily: FONTS.uiBold, fontSize: 76, lineHeight: 82, textAlign: 'center', minWidth: 120 },
  heroLabel: { fontFamily: FONTS.uiMedium, fontSize: 16, marginTop: -2 },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 16,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metricCol: { alignItems: 'center', gap: 2, minWidth: 64 },
  divider: { width: 1, height: 34 },
  metricValue: { fontFamily: FONTS.uiBold, fontSize: 26, fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: FONTS.uiMedium, fontSize: 13 },

  rewardRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 12 },
  rewardTile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 18, borderRadius: 18, overflow: 'hidden' },
  rewardBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  rewardBadgeText: { fontFamily: FONTS.uiBold, fontSize: 11, color: '#FFFFFF' },
  rewardValueRow: { flexDirection: 'row', alignItems: 'center' },
  rewardValue: { fontFamily: FONTS.uiBold, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  rewardLabel: { fontFamily: FONTS.uiMedium, fontSize: 12 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },

  actions: { paddingHorizontal: 24, gap: 6 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 16 },
  shareBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 16, color: PALETTE.onAccent },
  doneBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
});
