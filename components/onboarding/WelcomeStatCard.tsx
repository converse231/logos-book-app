import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/shared/AppIcon';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, SHADOW } from '@/theme/tokens';
import { CountUp } from './CountUp';

// RULE 1: an animated mock stat card that shows, not tells, what a year of
// tracking builds. Framed explicitly ("ONE YEAR FROM NOW") so the user reads it
// as their own potential, not abstract sample data. Decorative motion (flame
// pulse) is reduced-motion gated; numbers settle instantly under reduced motion.
export function WelcomeStatCard() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();

  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [flameScale, reduceMotion]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flameScale.value }] }));

  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      {/* framing header — tells the user this is their future */}
      <View style={styles.header}>
        <View style={styles.overlineRow}>
          <AppIcon name="sparkles" tint="accent" size={13} />
          <Text style={[styles.overline, { color: t.accent }]} numberOfLines={1}>
            ONE YEAR FROM NOW
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
          <Text style={[styles.pillText, { color: t.accent }]}>LV 7 · BIBLIOPHILE</Text>
        </View>
      </View>

      {/* streak flame */}
      <View style={styles.flameRow}>
        <View style={styles.flameWrap}>
          <Animated.View style={flameStyle}>
            <AppIcon name="flame" tint="ember" size={48} />
          </Animated.View>
        </View>
        <View style={styles.flameText}>
          <Text style={[styles.streakNum, { color: t.text }]}>24</Text>
          <Text style={[styles.streakLabel, { color: t.textSec }]}>DAY READING STREAK</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      {/* counting stats with clear sub-labels */}
      <View style={styles.statsRow}>
        <Stat to={1840} label="pages read" color={t.text} sub={t.textSec} />
        <Stat to={47} label="hours" color={t.text} sub={t.textSec} delay={150} />
        <Stat to={12} label="books finished" color={t.text} sub={t.textSec} delay={300} />
      </View>
    </View>
  );
}

function Stat({
  to,
  label,
  color,
  sub,
  delay = 0,
}: {
  to: number;
  label: string;
  color: string;
  sub: string;
  delay?: number;
}) {
  return (
    <View style={styles.stat}>
      <CountUp to={to} delayMs={delay} style={[styles.statValue, { color }]} />
      <Text style={[styles.statLabel, { color: sub }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: BORDER_WIDTH, padding: 18, gap: 14, ...SHADOW.card },
  // Both labels are fixed-width mono and neither can shrink, so on a narrow
  // screen space-between let the pill ride over "…NOW". wrap + gap drops the
  // pill to its own line instead of overlapping.
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
  },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  overline: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1, flexShrink: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  pillText: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 0.6 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flameWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  flameText: { flex: 1 },
  streakNum: { fontFamily: FONTS.monoBold, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  streakLabel: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5 },
  divider: { height: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 24, textAlign: 'center', minWidth: 56 },
  statLabel: { fontFamily: FONTS.mono, fontSize: 11, textAlign: 'center', letterSpacing: 0.4 },
});
