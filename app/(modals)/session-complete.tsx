import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW, type ThemeTokens } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useSessionStore } from '@/stores/sessionStore';
import { CountUp } from '@/components/onboarding/CountUp';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
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
  const pph = !isAudio && result.durationSeconds > 0 ? Math.round(pages / (result.durationSeconds / 3600)) : 0;

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
        {/* Hero — the book, big, with a celebration sticker stamped on its corner */}
        <Reveal d={d(0)} reduce={reduce}>
          {active?.bookTitle ? (
            <View style={styles.coverWrap}>
              <BookCover url={active.coverUrl} title={active.bookTitle} format={active.format} width={124} />
              <View style={[styles.coverSticker, { backgroundColor: isPB ? t.gold : t.accent, borderColor: t.border }]}>
                <Ionicons name={isPB ? 'trophy' : 'checkmark'} size={20} color={isPB ? '#141414' : t.onAccent} />
              </View>
            </View>
          ) : (
            <View style={[styles.checkCircle, { backgroundColor: isPB ? 'rgba(255,197,61,0.16)' : 'rgba(255,61,31,0.14)', borderColor: t.border }]}>
              <Ionicons name={isPB ? 'trophy' : 'checkmark'} size={42} color={isPB ? t.gold : t.accent} />
            </View>
          )}
        </Reveal>

        <Reveal d={d(110)} reduce={reduce}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: t.text }]}>{isPB ? 'PERSONAL BEST' : 'SESSION COMPLETE'}</Text>
            {active?.bookTitle ? (
              <Text style={[styles.bookCtx, { color: t.textSec }]} numberOfLines={1}>
                {active.bookTitle.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </Reveal>

        {/* Headline stat — a single colour-blocked figure */}
        <Reveal d={d(210)} reduce={reduce}>
          <View style={[styles.heroStat, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
            <CountUp to={heroValue} style={[styles.heroNum, { color: t.text }]} />
            <Text style={[styles.heroStatLabel, { color: t.text }]}>{heroLabel.toUpperCase()}</Text>
          </View>
        </Reveal>

        {/* Supporting telemetry — crisp bordered cells */}
        <Reveal d={d(290)} reduce={reduce}>
          <View style={styles.statRow}>
            <StatCell value={`${minutes}`} label={minutes === 1 ? 'MINUTE' : 'MINUTES'} t={t} />
            {!isAudio ? <StatCell value={`${pph}`} label="PAGES / HR" t={t} /> : null}
            {isPB ? <StatCell value="★" label="BEST" color={t.gold} t={t} /> : null}
          </View>
        </Reveal>

        {/* Rewards — streak (amber) + XP (gold) blocks */}
        {result.streak.incremented || result.xpGained > 0 ? (
          <Reveal d={d(380)} reduce={reduce}>
            <View style={styles.rewardRow}>
              {result.streak.incremented ? (
                <RewardTile tone="emerald" icon="flame" label="DAY STREAK" badge="+1" t={t}>
                  <Text style={[styles.rewardValue, { color: t.ember }]}>{result.streak.current}</Text>
                </RewardTile>
              ) : null}
              <RewardTile tone="gold" icon="sparkles" label="XP EARNED" t={t}>
                <Text style={[styles.rewardValue, { color: t.gold }]}>+</Text>
                <CountUp to={result.xpGained} style={[styles.rewardValue, { color: t.gold }]} />
              </RewardTile>
            </View>
          </Reveal>
        ) : null}

        {/* Badges */}
        {result.newBadges.length > 0 ? (
          <Reveal d={d(500)} reduce={reduce}>
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

// Module-level so confetti / insight state changes don't remount these and
// replay every entrance + the count-ups (the old inline-component double-fire).
function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(440)}>{children}</Animated.View>;
}

function StatCell({ value, label, color, t }: { value: string; label: string; color?: string; t: ThemeTokens }) {
  return (
    <View style={[styles.statCell, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <Text style={[styles.statValue, { color: color ?? t.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: t.textSec }]} numberOfLines={1}>
        {label}
      </Text>
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
  // Non-gold tone is the streak tile → amber (ember), never the vermilion primary.
  const color = tone === 'gold' ? t.gold : t.ember;
  const tint = tone === 'gold' ? 'rgba(255,197,61,0.14)' : 'rgba(255,138,30,0.16)';
  return (
    <View style={[styles.rewardTile, { backgroundColor: tint, borderColor: t.border }]}>
      {badge ? (
        <View style={[styles.rewardBadge, { backgroundColor: color, borderColor: t.border }]}>
          <Text style={styles.rewardBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.rewardValueRow}>{children}</View>
      <Text style={[styles.rewardLabel, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 16 },

  // Cover hero
  coverWrap: { alignSelf: 'center', position: 'relative' },
  coverSticker: {
    position: 'absolute', top: -12, right: -12, width: 38, height: 38, borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: { alignSelf: 'center', width: 78, height: 78, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },

  // Title block
  titleBlock: { alignItems: 'center', gap: 4 },
  title: { fontFamily: FONTS.displayBold, fontSize: 28, letterSpacing: -0.5, textAlign: 'center' },
  bookCtx: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.6, textAlign: 'center', maxWidth: 280 },

  // Headline stat block
  heroStat: {
    alignSelf: 'stretch', borderRadius: 0, borderWidth: BORDER_WIDTH_THICK,
    paddingVertical: 18, paddingHorizontal: 20, ...SHADOW.card,
  },
  heroNum: { fontFamily: FONTS.monoBold, fontSize: 60, lineHeight: 64, fontVariant: ['tabular-nums'] },
  heroStatLabel: { fontFamily: FONTS.monoMedium, fontSize: 13, letterSpacing: 1, marginTop: 2 },

  // Supporting stat cells
  statRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 12 },
  statCell: { flex: 1, borderRadius: 0, borderWidth: BORDER_WIDTH, paddingVertical: 14, paddingHorizontal: 12, gap: 2, ...SHADOW.sm },
  statValue: { fontFamily: FONTS.monoBold, fontSize: 24, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },

  // Reward blocks
  rewardRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 12 },
  rewardTile: { flex: 1, alignItems: 'flex-start', gap: 4, padding: 14, borderRadius: 0, borderWidth: BORDER_WIDTH, overflow: 'hidden', ...SHADOW.sm },
  rewardBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 0, borderLeftWidth: BORDER_WIDTH, borderBottomWidth: BORDER_WIDTH },
  rewardBadgeText: { fontFamily: FONTS.monoBold, fontSize: 11, color: '#FFFFFF' },
  rewardValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rewardValue: { fontFamily: FONTS.monoBold, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  rewardLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },

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
