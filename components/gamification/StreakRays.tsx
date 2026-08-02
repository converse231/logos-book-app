import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Polygon, RadialGradient, Rect, Stop, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const RAY_COUNT = 16;   // 8 long + 8 short, alternating
const SPIN_MS = 22000;  // one slow revolution — ambient, never distracting
const PULSE_MS = 2600;

// The rotating light behind a streak flame: a hard-edged sunburst turning slowly,
// with a soft radial bloom breathing underneath it. Both take the flame's own
// colour, so the burst shifts amber → gold → blue → violet as the streak climbs.
//
// Drawn as SVG polygons rather than a stack of rotated Views: one node, one
// transform, and the tapered wedges keep clean edges at any size. Only the wrapper
// animates, so the whole thing runs as a single transform on the UI thread.
export function StreakRays({ size, color }: { size: number; color: string }) {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, spin, pulse]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.28,
    transform: [{ scale: 0.94 + pulse.value * 0.1 }],
  }));

  // Wedges radiating from the centre, WIDE AT THE BASE and tapering to a point —
  // the way light actually falls away. (Built the other way round first, fat at the
  // tip, and it read as a hard-edged cog.) Alternating reach gives the burst its
  // rhythm; a ring of identical spokes reads as a loading spinner.
  const rays = useMemo(() => {
    const c = size / 2;
    const step = 360 / RAY_COUNT;
    const base = c * 0.09; // spokes start just outside the centre, never at a single point
    return Array.from({ length: RAY_COUNT }, (_, i) => {
      const long = i % 2 === 0;
      const reach = c * (long ? 1.0 : 0.64);
      const half = (step * (long ? 0.34 : 0.2) * Math.PI) / 180;
      const a = ((i * step - 90) * Math.PI) / 180;
      const pt = (ang: number, r: number) => `${c + Math.cos(ang) * r},${c + Math.sin(ang) * r}`;
      return {
        key: i,
        points: `${pt(a - half, base)} ${pt(a, reach)} ${pt(a + half, base)}`,
        opacity: long ? 0.34 : 0.2,
      };
    });
  }, [size]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {/* Bloom sits under the spokes so the centre never looks hollow. */}
      <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
              <Stop offset="45%" stopColor={color} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={size} height={size} fill="url(#bloom)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Every spoke is painted through one radial fade, so the tips dissolve
                into the scrim instead of ending on a hard edge. */}
            <RadialGradient id="rayFade" gradientUnits="userSpaceOnUse" cx={size / 2} cy={size / 2} r={size / 2}>
              <Stop offset="0%" stopColor={color} stopOpacity="1" />
              <Stop offset="42%" stopColor={color} stopOpacity="0.82" />
              <Stop offset="78%" stopColor={color} stopOpacity="0.26" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <G>
            {rays.map((r) => (
              <Polygon key={r.key} points={r.points} fill="url(#rayFade)" fillOpacity={r.opacity} />
            ))}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
