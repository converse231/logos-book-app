import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Firefly, flySpec } from '@/components/jar/Firefly';
import { useFlyClock } from '@/components/jar/FireflyJar';

/** How many bugs to actually draw for a grant. A 25-firefly session shouldn't
 *  put 25 sprites on the celebration screen — past a handful it reads as a
 *  swarm rather than a count, and the number beside it says the truth anyway. */
const MAX = 9;

interface Props {
  /** Fireflies earned. Drives how many appear. */
  count: number;
  width: number;
  height: number;
  /** Flip to true to send them looping off-screen (on Finish). */
  leaving?: boolean;
}

/**
 * The fireflies that turn up on the session-complete screen.
 *
 * They fade in over the copy, drift and flash in place, then — when the reader
 * finishes — spiral outward crossing each other's paths while the screen
 * transitions away. The scatter reuses each fly's own lissajous phase as its
 * heading, so they leave in different directions without any of them being
 * assigned one.
 */
export function FireflySwarm({ count, width, height, leaving = false }: Props) {
  const reduce = useReducedMotion();
  const clock = useFlyClock(reduce);
  const scatter = useSharedValue(0);
  const arrive = useSharedValue(reduce ? 1 : 0);

  const n = Math.max(0, Math.min(MAX, count));
  const specs = useMemo(() => Array.from({ length: n }, (_, i) => flySpec(i, 7)), [n]);

  useEffect(() => {
    if (reduce) return;
    arrive.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [reduce, arrive]);

  useEffect(() => {
    if (!leaving) return;
    // Ease-in: they hang for a beat, then accelerate away — the opposite curve
    // to arriving, which is what makes it read as leaving rather than snapping.
    scatter.value = withTiming(1, { duration: 900, easing: Easing.in(Easing.cubic) });
  }, [leaving, scatter]);

  const fade = useAnimatedStyle(() => ({ opacity: arrive.value }));

  if (n === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} pointerEvents="none">
      <Animated.View style={[{ width, height }, fade]}>
        {specs.map((spec, i) => (
          <Firefly
            key={i}
            spec={spec}
            clock={clock}
            boxW={width}
            boxH={height}
            reduce={reduce}
            scatter={scatter}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
