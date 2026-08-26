import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { shortDate, type RhythmBar } from '@/lib/bookReport';

// The shape of a read: one bar per day across the whole span, empty days
// included. The gaps are the point — a slow first week, a weekend that ran away
// with you, the sprint to the end. It is the only chart in the app that is about
// a single book, and the most personal thing on the report.
//
// Bars grow from the baseline in a left-to-right stagger, which reads as the
// book being re-read in fast-forward.
export function ReadingRhythm({
  bars,
  weekly,
  unit,
  height = 82,
}: {
  bars: RhythmBar[];
  weekly: boolean;
  unit: 'pages' | 'minutes';
  height?: number;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  if (!bars.length) return null;

  const peak = Math.max(...bars.map((b) => b.value), 1);
  const peakIdx = bars.findIndex((b) => b.value === peak);
  // Past ~70 bars the stagger becomes a crawl and each bar is sub-pixel anyway.
  const step = Math.min(26, Math.max(6, Math.round(900 / bars.length)));

  return (
    <View style={styles.wrap}>
      <View style={[styles.plot, { height }]}>
        {bars.map((b, i) => (
          <Bar
            key={b.date}
            frac={b.value / peak}
            empty={b.empty}
            best={i === peakIdx && b.value > 0}
            delay={reduce ? 0 : 120 + i * step}
            reduce={reduce}
            t={t}
          />
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.tick, { color: t.textTer }]}>{shortDate(bars[0].date)}</Text>
        <Text style={[styles.tick, { color: t.textTer }]}>
          {`peak ${peak} ${unit === 'pages' ? 'p' : 'min'}${weekly ? '/wk' : '/day'}`}
        </Text>
        <Text style={[styles.tick, { color: t.textTer }]}>
          {shortDate(bars[bars.length - 1].date)}
        </Text>
      </View>
    </View>
  );
}

function Bar({
  frac, empty, best, delay, reduce, t,
}: {
  frac: number;
  empty: boolean;
  best: boolean;
  delay: number;
  reduce: boolean;
  t: ReturnType<typeof useTheme>;
}) {
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    grow.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 170, mass: 0.7 }));
  }, [delay, reduce, grow]);

  // scaleY from the baseline, so bars rise out of the axis rather than
  // materialising at full height.
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.value }],
    opacity: 0.35 + grow.value * 0.65,
  }));

  return (
    <View style={styles.slot}>
      <Animated.View
        style={[
          styles.bar,
          {
            // An empty day still draws a hairline, so the gap is visibly a day
            // that happened rather than a hole in the chart. Both branches are
            // percentage template literals so the type stays DimensionValue.
            height: empty ? '3%' : `${Math.max(4, frac * 100)}%`,
            backgroundColor: empty ? t.border : best ? t.gold : t.accent,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2, transformOrigin: 'bottom' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tick: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.2 },
});
