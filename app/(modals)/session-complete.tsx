import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { FONTS, PALETTE, INK, ANIMATION, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW, type ThemeTokens } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import type { BookFormat } from '@/services/types';
import { useSessionStore } from '@/stores/sessionStore';
import { CountUp } from '@/components/onboarding/CountUp';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
import { ReadingInsightCard } from '@/components/session/ReadingInsightCard';
import { BookCover } from '@/components/shared/BookCover';

// The Duolingo moment (blueprint Section 5 timeline). The book cover is the hero —
// it springs in, big, under a hard ink shadow with a celebration stamp — then the
// telemetry lands beneath it as neubrutalist stat blocks whose figures count up
// on the UI thread. Confetti fires from two side cannons + a centre pop (bigger
// for a personal best); the variable-reward insight slides up after ~2s if the
// server granted one. All motion is reduced-motion gated.
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

  const showStreak = result.streak.incremented;

  // One tidy row of cards telling the session's story: what you read, the streak
  // it fed, and the XP it earned. Streak takes the middle slot when it ticked;
  // otherwise minutes fills it (audiobooks lead with minutes, so they skip it).
  const cards: StatSpec[] = [
    isAudio
      ? { key: 'primary', value: minutes, label: 'MINUTES', tint: t.accentMuted, valueColor: t.text }
      : { key: 'primary', value: pages, label: pages === 1 ? 'PAGE' : 'PAGES', tint: t.accentMuted, valueColor: t.text },
  ];
  if (showStreak) {
    cards.push({ key: 'streak', value: result.streak.current, label: 'DAY STREAK', tint: 'rgba(255,138,30,0.16)', valueColor: t.ember });
  } else if (!isAudio) {
    cards.push({ key: 'minutes', value: minutes, label: 'MINUTES', tint: t.bgSec, valueColor: t.text });
  }
  cards.push({ key: 'xp', value: result.xpGained, label: 'XP EARNED', tint: 'rgba(255,197,61,0.16)', valueColor: t.gold, prefix: '+' });

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
        {/* Hero — the book, big, springing in under a hard shadow with a stamp */}
        <CoverHero
          coverUrl={active?.coverUrl}
          title={active?.bookTitle ?? 'Book'}
          format={active?.format}
          isPB={isPB}
          reduce={reduce}
        />

        <Reveal d={d(120)} reduce={reduce}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: isPB ? t.gold : t.text }]}>
              {isPB ? 'PERSONAL BEST' : 'SESSION COMPLETE'}
            </Text>
            {active?.bookTitle ? (
              <Text style={[styles.bookCtx, { color: t.textSec }]} numberOfLines={1}>
                {active.bookTitle.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </Reveal>

        {/* One row of stat cards — figures counting up */}
        <Reveal d={d(210)} reduce={reduce}>
          <View style={styles.cardRow}>
            {cards.map((c) => (
              <StatCard key={c.key} spec={c} t={t} />
            ))}
          </View>
        </Reveal>

        {/* Badges */}
        {result.newBadges.length > 0 ? (
          <Reveal d={d(460)} reduce={reduce}>
            <View style={styles.badges}>
              {result.newBadges.map((b) => (
                <View key={b.id} style={[styles.badge, { backgroundColor: t.bgSec, borderColor: t.border }]}>
                  <Ionicons name="ribbon" size={18} color={t.gold} />
                  <Text style={[styles.badgeText, { color: t.text }]}>{b.name.toUpperCase()}</Text>
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
        <PressBlock
          onPress={share}
          accessibilityLabel="Share your reading card"
          style={[styles.shareBtn, { backgroundColor: t.accent }]}
        >
          <Ionicons name="share-social" size={20} color={PALETTE.onAccent} />
          <Text style={styles.shareBtnText}>SHARE YOUR CARD</Text>
        </PressBlock>
        <PressBlock
          onPress={finish}
          haptic="light"
          accessibilityLabel="Done"
          style={[styles.doneBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <Text style={[styles.doneText, { color: t.text }]}>DONE</Text>
        </PressBlock>
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

// The centrepiece: the cover springs up from nothing, sits on a hard ink shadow,
// and takes a celebration stamp on its corner (trophy on a personal best).
function CoverHero({
  coverUrl,
  title,
  format,
  isPB,
  reduce,
}: {
  coverUrl?: string | null;
  title: string;
  format?: BookFormat;
  isPB: boolean;
  reduce: boolean;
}) {
  const t = useTheme();
  const scale = useSharedValue(reduce ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(80, withSpring(1, ANIMATION.springBouncy));
  }, [reduce, scale]);

  return (
    <Animated.View style={[styles.coverWrap, style]}>
      <View style={styles.coverShadow}>
        <BookCover url={coverUrl} title={title} format={format} width={160} />
      </View>
      <View style={[styles.coverSticker, { backgroundColor: isPB ? t.gold : t.accent, borderColor: t.border }]}>
        <Ionicons name={isPB ? 'trophy' : 'checkmark'} size={22} color={isPB ? INK : t.onAccent} />
      </View>
    </Animated.View>
  );
}

// Module-level so confetti / insight state changes don't remount these and
// replay every entrance + the count-ups (the old inline-component double-fire).
function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(440)}>{children}</Animated.View>;
}

type StatSpec = {
  key: string;
  value: number;
  label: string;
  tint: string;
  valueColor: string;
  prefix?: string;
};

// One neubrutalist stat card: a tinted, ink-bordered block on a hard shadow with
// a figure that counts up on the UI thread and a mono label. A row of these
// summarises the session under the cover hero.
function StatCard({ spec, t }: { spec: StatSpec; t: ThemeTokens }) {
  return (
    <View
      style={[styles.card, { backgroundColor: spec.tint, borderColor: t.border }]}
      accessible
      accessibilityLabel={`${spec.prefix ?? ''}${spec.value} ${spec.label}`}
    >
      <View style={styles.cardValueRow}>
        {spec.prefix ? <Text style={[styles.cardValue, { color: spec.valueColor }]}>{spec.prefix}</Text> : null}
        <CountUp to={spec.value} style={[styles.cardValue, { color: spec.valueColor }]} />
      </View>
      <Text style={[styles.cardLabel, { color: t.textSec }]} numberOfLines={2}>
        {spec.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28, gap: 16 },

  // Cover hero
  coverWrap: { alignSelf: 'center', position: 'relative', marginBottom: 4 },
  coverShadow: { ...SHADOW.lg },
  coverSticker: {
    position: 'absolute', top: -14, right: -14, width: 42, height: 42, borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center',
  },

  // Title block
  titleBlock: { alignItems: 'center', gap: 4 },
  title: { fontFamily: FONTS.displayBold, fontSize: 28, letterSpacing: -0.5, textAlign: 'center' },
  bookCtx: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.6, textAlign: 'center', maxWidth: 280 },

  // One row of stat cards
  cardRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 10 },
  card: {
    flex: 1, borderRadius: 0, borderWidth: BORDER_WIDTH, ...SHADOW.sm,
    paddingVertical: 18, paddingHorizontal: 8, minHeight: 96,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  cardValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cardValue: { fontFamily: FONTS.monoBold, fontSize: 34, lineHeight: 36, fontVariant: ['tabular-nums'], padding: 0 },
  cardLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, textAlign: 'center' },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 0, borderWidth: BORDER_WIDTH },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 0.5 },

  actions: { paddingHorizontal: 24, gap: 12 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
    borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
  },
  shareBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent },
  doneBtn: {
    minHeight: 50, alignItems: 'center', justifyContent: 'center',
    borderRadius: 0, borderWidth: BORDER_WIDTH,
  },
  doneText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
});
