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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { CountUp } from './CountUp';

// RULE 1: an animated mock stat card that shows, not tells, what a year of
// tracking builds. Framed explicitly ("ONE YEAR FROM NOW") so the user reads it
// as their own potential, not abstract sample data. Decorative motion (flame
// pulse) is reduced-motion gated; numbers settle instantly under reduced motion.
export function WelcomeStatCard() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();

  const flameScale = useSharedValue(1);
  const glow = useSharedValue(0.35);

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
    glow.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 900 }), withTiming(0.35, { duration: 900 })),
      -1,
      false
    );
  }, [flameScale, glow, reduceMotion]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flameScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      {/* framing header — tells the user this is their future */}
      <View style={styles.header}>
        <View style={styles.overlineRow}>
          <Ionicons name="sparkles" size={13} color={t.accent} />
          <Text style={[styles.overline, { color: t.accent }]}>ONE YEAR FROM NOW</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: 'rgba(61,123,255,0.14)' }]}>
          <Text style={[styles.pillText, { color: t.accent }]}>LV 7 · BIBLIOPHILE</Text>
        </View>
      </View>

      {/* streak flame */}
      <View style={styles.flameRow}>
        <View style={styles.flameWrap}>
          <Animated.View style={[styles.flameGlow, glowStyle, { backgroundColor: t.accent }]} />
          <Animated.View style={flameStyle}>
            <Ionicons name="flame" size={48} color={t.accent} />
          </Animated.View>
        </View>
        <View style={styles.flameText}>
          <Text style={[styles.streakNum, { color: t.text }]}>24</Text>
          <Text style={[styles.streakLabel, { color: t.textSec }]}>day reading streak</Text>
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
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overline: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontFamily: FONTS.uiBold, fontSize: 10, letterSpacing: 0.6 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flameWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  flameGlow: { position: 'absolute', width: 52, height: 52, borderRadius: 26 },
  flameText: { flex: 1 },
  streakNum: { fontFamily: FONTS.uiBold, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  streakLabel: { fontFamily: FONTS.uiMedium, fontSize: 14 },
  divider: { height: 1, opacity: 0.7 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 24, textAlign: 'center', minWidth: 56 },
  statLabel: { fontFamily: FONTS.uiMedium, fontSize: 12, textAlign: 'center' },
});
