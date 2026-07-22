import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
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
import { Sparkle } from '@/components/shared/Sparkle';
import { Q } from '@/components/shared/Q';

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
    // Escalation composited on top of this celebration: a streak milestone wins;
    // otherwise a level-up. Mutually exclusive so we never stack two full-screen
    // takeovers on one session.
    let escalate: ReturnType<typeof setTimeout> | null = null;
    if (result.milestoneVariant) {
      escalate = setTimeout(
        () => router.push(`/(modals)/milestone/${result.milestoneVariant}?count=${result.streak.current}` as Href),
        650
      );
    } else if (result.leveledUp) {
      escalate = setTimeout(
        () => router.push(`/(modals)/level-up?level=${result.level}&name=${encodeURIComponent(result.levelName)}` as Href),
        650
      );
    }
    // The insight only slides up when nothing bigger took over.
    const i =
      result.insight && !result.milestoneVariant && !result.leveledUp
        ? setTimeout(() => setShowInsight(true), 2000)
        : null;
    return () => {
      clearTimeout(c);
      if (escalate) clearTimeout(escalate);
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
            <Q expression={isPB ? 'surprised' : 'happy'} size={74} />
            <Text style={[styles.title, { color: isPB ? t.gold : t.text }]}>
              {isPB ? 'Personal best' : 'Session complete'}
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

const COVER_W = 160;
const LIFT_OFFSET = 7; // final hard-shadow offset — how far the block lifts

// The centrepiece. A layered, weighted reveal rather than a scale-from-nothing
// bounce — three beats that overlap:
//   1. SETTLE — the cover rises with a slight 3D tilt that straightens out, on a
//      well-damped spring (it lands; it doesn't wobble).
//   2. LIFT   — its hard ink shadow then slides out from flush, so the block
//      visibly peels off the page. This is the Paper & Ink signature, shared with
//      the add-book reveal.
//   3. STAMP  — the seal presses onto the corner last, with a tight pop.
// Reduced motion renders the settled end-state with no travel.
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
  const settle = useSharedValue(reduce ? 1 : 0);
  const lift = useSharedValue(reduce ? 1 : 0);
  const stamp = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    settle.value = withDelay(60, withSpring(1, ANIMATION.springSmooth));
    lift.value = withDelay(260, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    stamp.value = withDelay(440, withSpring(1, ANIMATION.springBouncy));
  }, [reduce, settle, lift, stamp]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [
      { perspective: 900 },
      { translateY: (1 - settle.value) * 24 },
      { rotateY: `${(1 - settle.value) * -14}deg` },
      { scale: 0.9 + settle.value * 0.1 },
    ],
  }));

  // The ink block starts flush behind the cover and slides to its offset.
  const liftStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [
      { translateX: lift.value * LIFT_OFFSET },
      { translateY: lift.value * LIFT_OFFSET },
    ],
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: stamp.value }, { rotate: `${(1 - stamp.value) * -30}deg` }],
  }));

  return (
    <View style={styles.coverWrap}>
      <Sparkle size={28} color={PALETTE.gold} delay={0} style={styles.sparkTL} />
      <Sparkle size={20} color={PALETTE.level} delay={320} style={styles.sparkR} />
      <Sparkle size={18} color={PALETTE.ember} delay={640} style={styles.sparkBL} />

      <Animated.View style={coverStyle}>
        <Animated.View style={[styles.liftBlock, liftStyle]} pointerEvents="none" />
        <BookCover url={coverUrl} title={title} format={format} width={COVER_W} />
      </Animated.View>

      <Animated.View
        style={[
          styles.coverSticker,
          stampStyle,
          { backgroundColor: isPB ? t.gold : t.accent, borderColor: t.border },
        ]}
      >
        <Ionicons name={isPB ? 'trophy' : 'checkmark'} size={22} color={isPB ? INK : t.onAccent} />
      </Animated.View>
    </View>
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
  // Sits flush behind the (opaque) cover and slides out to its offset, so only the
  // L-shape shows — a hard ink shadow that animates, which a boxShadow can't do.
  liftBlock: { ...StyleSheet.absoluteFillObject, backgroundColor: INK, borderRadius: 14 },
  coverSticker: {
    position: 'absolute', top: -14, right: -14, width: 42, height: 42, borderRadius: 21,
    borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center',
  },
  sparkTL: { position: 'absolute', top: -6, left: -12, zIndex: 2 },
  sparkR: { position: 'absolute', top: 74, right: -16, zIndex: 2 },
  sparkBL: { position: 'absolute', bottom: 26, left: -8, zIndex: 2 },

  // Title block
  titleBlock: { alignItems: 'center', gap: 4 },
  title: { fontFamily: FONTS.serifBold, fontSize: 38, lineHeight: 40, letterSpacing: 0, textAlign: 'center' },
  bookCtx: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.6, textAlign: 'center', maxWidth: 280 },

  // One row of stat cards
  cardRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 10 },
  card: {
    flex: 1, borderRadius: 14, borderWidth: BORDER_WIDTH, ...SHADOW.sm,
    paddingVertical: 18, paddingHorizontal: 8, minHeight: 96,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  cardValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cardValue: { fontFamily: FONTS.monoBold, fontSize: 34, lineHeight: 36, fontVariant: ['tabular-nums'], padding: 0 },
  cardLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, textAlign: 'center' },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: BORDER_WIDTH },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 0.5 },

  actions: { paddingHorizontal: 24, gap: 12 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
    borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
  },
  shareBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent },
  doneBtn: {
    minHeight: 50, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: BORDER_WIDTH,
  },
  doneText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
});
