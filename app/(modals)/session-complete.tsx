import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN_FILL } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { useSessionStore } from '@/stores/sessionStore';
import { celebrationFor } from '@/lib/sessionCelebration';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
import { ReadingInsightCard } from '@/components/session/ReadingInsightCard';
import { Q } from '@/components/shared/Q';

// Session Success — the celebration, and only the celebration.
//
// Restructured (2026-08-06) from a packed screen — cover hero, three tall stat
// cards, badge chips, share and done — into one image and one stub. Q now owns
// roughly two-thirds of the screen; the numbers are a single bordered ticket
// pinned above the buttons.
//
// Q's pose and the headline both come from lib/sessionCelebration's priority
// ladder, so finishing a book, setting a personal best and logging four pages
// before bed no longer look identical.
//
// Motion: entrance ONLY. Q springs in once, confetti fires, the stub fades up —
// then everything is still. The idle bob is deliberately off (`animated={false}`);
// a mascot that floats forever reads as cheap.
//
// Unchanged: a level-up still takes over at 650ms, and the variable-reward insight
// still slides up at 2s when nothing bigger took over.
export default function SessionComplete() {
  const params = useLocalSearchParams<{ finished?: string }>();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();

  const result = useSessionStore((s) => s.lastResult);
  const active = useSessionStore((s) => s.active);
  const clearResult = useSessionStore((s) => s.clearResult);
  const endSession = useSessionStore((s) => s.endSession);

  const [fireConfetti, setFireConfetti] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  // Q is sized from the space the stage ACTUALLY got, not from the window. Deriving
  // it from window height meant that on layouts where the copy or the badge footer
  // ran tall, Q was drawn bigger than its flex allocation and bled over the
  // headline beneath it.
  const [stageH, setStageH] = useState(0);

  const finishedBook = params.finished === '1';

  const celebration = useMemo(
    () =>
      celebrationFor({
        finishedBook,
        isPersonalBest: result?.isPersonalBest ?? false,
        badgeCount: result?.newBadges.length ?? 0,
        durationSeconds: result?.durationSeconds ?? 0,
        pagesRead: result?.pagesRead ?? null,
        isAudiobook: active?.format === 'audiobook',
        localHour: new Date().getHours(),
      }),
    [finishedBook, result, active]
  );

  // Entrance: one spring, no loop.
  const pop = useSharedValue(reduce ? 1 : 0.6);
  useEffect(() => {
    if (!result) {
      router.replace('/(tabs)/home' as Href);
      return;
    }
    const c = setTimeout(() => setFireConfetti(true), 150);
    if (!reduce) pop.value = withDelay(60, withSpring(1, { damping: 13, stiffness: 140, mass: 0.9 }));

    // Level-up is the one thing still allowed to take the screen. Streak milestones
    // celebrate on Home (see lib/streakCelebration) so they can't stack here.
    const escalate = result.leveledUp
      ? setTimeout(
          () =>
            router.push(
              `/(modals)/level-up?level=${result.level}&name=${encodeURIComponent(result.levelName)}` as Href
            ),
          650
        )
      : null;
    const i = result.insight && !result.leveledUp ? setTimeout(() => setShowInsight(true), 2000) : null;
    return () => {
      clearTimeout(c);
      if (escalate) clearTimeout(escalate);
      if (i) clearTimeout(i);
    };
  }, [result, router, reduce, pop]);

  const qStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : Math.min(1, (pop.value - 0.55) * 3.4),
    transform: [{ scale: pop.value }],
  }));

  if (!result) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const isAudio = active?.format === 'audiobook';
  const minutes = Math.max(1, Math.round(result.durationSeconds / 60));
  const pages = result.pagesRead ?? 0;
  const badge = result.newBadges[0] ?? null;
  const d = (n: number) => (reduce ? 0 : n);

  // 0.90 of the measured stage. That figure is what keeps everything inside without
  // needing a clip: the halo sits at 1.08x (0.97 of the stage) and the entrance
  // spring — damping 13, stiffness 140, mass 0.9, so underdamped and overshooting
  // ~11% — peaks at 0.997. Raising this much above 0.90 makes the overshoot collide
  // with the headline again, which is the bug this replaced.
  // The window-based value is only the first-frame estimate, replaced on layout.
  const qSize = stageH > 0
    ? Math.max(150, Math.min(320, stageH * 0.9))
    : Math.max(190, Math.min(300, height * 0.34));
  const gold = celebration.halo === 'gold';
  const fireflies = result.firefliesEarned ?? 0;

  const finish = () => {
    clearResult();
    endSession();
    router.replace('/(tabs)/home' as Href);
  };
  const share = () => router.push('/(modals)/share-card' as Href);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <Confetti fire={fireConfetti} particleCount={gold ? 120 : 80} />

      <View style={styles.column}>
        {/* Hero — Q, with nothing behind or over him. */}
        <View
          style={styles.stage}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (Math.abs(h - stageH) > 1) setStageH(h);
          }}
        >
          <View
            style={[
              styles.halo,
              {
                width: qSize * 1.08,
                height: qSize * 1.08,
                borderRadius: qSize,
                backgroundColor: gold ? 'rgba(243,194,76,0.30)' : t.accentMuted,
              },
            ]}
          />
          <Animated.View style={qStyle}>
            <Q expression={celebration.expression} size={qSize} animated={false} decorative />
          </Animated.View>
        </View>

        {/* Copy sits BELOW the art — it used to be behind it. */}
        <Animated.View entering={reduce ? undefined : FadeInUp.delay(d(280)).duration(420)}>
          <Text style={[styles.headline, { color: gold ? t.gold : t.text }]}>{celebration.headline}</Text>
          {active?.bookTitle ? (
            <Text style={[styles.sub, { color: t.textSec }]} numberOfLines={1}>
              {active.bookTitle}
            </Text>
          ) : null}
        </Animated.View>

        {fireflies > 0 ? (
          <Animated.View
            entering={reduce ? undefined : FadeInUp.delay(d(340)).duration(420)}
            style={styles.fireflyLine}
          >
            <Text style={[styles.fireflyText, { color: t.gold }]}>
              You collected {fireflies} {fireflies === 1 ? 'firefly' : 'fireflies'}
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.spacer} />

        {/* The stub: three cells, plus a torn-off footer only when a badge landed. */}
        <Animated.View
          entering={reduce ? undefined : FadeInUp.delay(d(400)).duration(420)}
          style={[styles.ticket, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <View style={styles.ticketRow}>
            <Cell
              value={isAudio ? String(minutes) : String(pages)}
              label={isAudio ? 'MINUTES' : pages === 1 ? 'PAGE' : 'PAGES'}
              t={t}
            />
            <Cell
              value={String(isAudio ? result.streak.current : minutes)}
              label={isAudio ? 'DAY STREAK' : 'MINUTES'}
              t={t}
              divider
            />
            <Cell value={`+${result.xpGained}`} label="XP" t={t} divider tint={t.gold} />
          </View>
          {badge ? (
            <View style={[styles.ticketFoot, { borderTopColor: t.textTer }]}>
              <Ionicons name="ribbon" size={15} color={t.gold} />
              <Text style={[styles.ticketFootText, { color: t.text }]} numberOfLines={1}>
                Achievement unlocked — {badge.name}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={reduce ? undefined : FadeIn.delay(d(520)).duration(380)}
          style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}
        >
          <PressBlock
            emphasis="primary"
            onPress={finish}
            haptic="light"
            accessibilityLabel="Finish"
            style={[styles.primary, { backgroundColor: t.accent, borderColor: INK }]}
          >
            <Text style={styles.primaryText}>FINISH</Text>
          </PressBlock>
          <PressBlock
            onPress={share}
            accessibilityLabel="Share your reading card"
            style={[styles.secondary, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="share-social" size={17} color={t.text} />
            <Text style={[styles.secondaryText, { color: t.text }]}>SHARE YOUR CARD</Text>
          </PressBlock>
        </Animated.View>
      </View>

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

function Cell({
  value,
  label,
  t,
  divider = false,
  tint,
}: {
  value: string;
  label: string;
  t: ReturnType<typeof useTheme>;
  divider?: boolean;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.cell,
        divider && { borderLeftWidth: BORDER_WIDTH, borderLeftColor: t.textTer, borderStyle: 'dashed' },
      ]}
    >
      <Text style={[styles.cellValue, { color: tint ?? t.text }]}>{value}</Text>
      <Text style={[styles.cellLabel, { color: t.textSec }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { ...CENTER_COLUMN_FILL, paddingHorizontal: 22 },

  // No overflow:hidden. Q is measured to fit the stage, so a clip could never fire —
  // and if a future change made it fire, silently cropping the mascot is a worse
  // outcome than seeing the layout break. minHeight:0 is what actually lets this
  // flex child shrink.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  halo: { position: 'absolute' },

  headline: { fontFamily: FONTS.serifBold, fontSize: 27, lineHeight: 32, textAlign: 'center', ...NO_FONT_PAD },
  sub: { fontFamily: FONTS.uiRegular, fontSize: 13, textAlign: 'center', marginTop: 6 },

  // Absorbs the slack so the stub sits at the foot of the screen rather than
  // floating just under the copy.
  spacer: { flex: 0.42 },
  fireflyLine: { alignItems: 'center', marginTop: 10 },
  fireflyText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.2 },

  ticket: {
    borderWidth: BORDER_WIDTH_THICK,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    boxShadow: `4px 4px 0px ${INK}`,
  },
  ticketRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 },
  cellValue: { fontFamily: FONTS.monoBold, fontSize: 24, fontVariant: ['tabular-nums'], ...NO_FONT_PAD },
  cellLabel: { fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1.1, marginTop: 4 },
  ticketFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderTopWidth: BORDER_WIDTH,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(243,194,76,0.18)',
  },
  ticketFootText: { flex: 1, fontFamily: FONTS.uiBold, fontSize: 12.5, letterSpacing: 0.2 },

  actions: { paddingTop: 14, gap: 10 },
  primary: {
    minHeight: 54, alignItems: 'center', justifyContent: 'center',
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
  },
  primaryText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  secondary: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
  },
  secondaryText: { fontFamily: FONTS.uiBold, fontSize: 13, letterSpacing: 0.8 },
});
