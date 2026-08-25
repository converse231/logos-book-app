import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Firefly, flySpec } from '@/components/jar/Firefly';
import { POUCH_COST } from '@/components/curio/curios';

const JAR = require('@/assets/jar/jar.webp');

/** Measured off jar.webp: the glass interior as a fraction of the image. */
const IN = { x: 0.152, y: 0.238, w: 0.712, h: 0.654 };
const JAR_AR = 561 / 760;

// Tied to the pouch price on purpose. At 26 the jar looked full while a pouch
// still cost 40, so the art contradicted the progress bar sitting under it — a
// full jar now means exactly "you can afford a pouch".
//
// It is also a render budget: each fly costs ~6 animated styles on the UI
// thread, so this is 240 of them. If a low-end device drops frames in the jar,
// this is the knob — but decoupling it reopens the seam above.
const MAX_FLIES = POUCH_COST;

/**
 * One drawn fly per firefly you own, capped.
 *
 * This used to scale as a FRACTION of a full jar — 15 fireflies rendered 4 —
 * so the count printed under the jar and the jar itself disagreed. The number
 * is the thing that's true, so the art follows it.
 *
 * Past MAX_FLIES the jar just reads "full"; the progress bar carries the rest
 * of the way to a pouch. The cap equals the pouch price, so a visually full jar
 * and an affordable pouch are the same moment.
 */
export function visibleFlies(balance: number): number {
  if (balance <= 0) return 0;
  return Math.min(MAX_FLIES, Math.round(balance));
}

/**
 * One clock in seconds, shared by every firefly on the screen.
 *
 * Wraps at 600s so the float never grows large enough to lose precision in a
 * worklet, and 600 is a common multiple of nothing in the flash periods — so a
 * wrap never lands mid-flash for all of them at once.
 */
export function useFlyClock(reduce: boolean) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(600, { duration: 600_000, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduce, clock]);
  return clock;
}

interface Props {
  balance: number;
  width: number;
  style?: StyleProp<ViewStyle>;
}

export function FireflyJar({ balance, width, style }: Props) {
  const height = width / JAR_AR;
  const reduce = useReducedMotion();
  const clock = useFlyClock(reduce);

  const box = useMemo(
    () => ({ x: width * IN.x, y: height * IN.y, w: width * IN.w, h: height * IN.h }),
    [width, height]
  );

  const count = visibleFlies(balance);
  const specs = useMemo(
    () => Array.from({ length: count }, (_, i) => flySpec(i, count, box.w, box.h)),
    [count, box.w, box.h]
  );

  return (
    <View style={[{ width, height }, style]}>
      <Image source={JAR} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
      <View style={[styles.interior, { left: box.x, top: box.y, width: box.w, height: box.h }]}>
        {specs.map((spec, i) => (
          <Firefly key={i} spec={spec} clock={clock} boxW={box.w} boxH={box.h} reduce={reduce} />
        ))}
      </View>
      {/* The glass again over the contents, so its highlights fall ON the
          fireflies — that's what puts them inside the jar rather than in front. */}
      <Image
        source={JAR}
        style={[StyleSheet.absoluteFill, styles.glass]}
        contentFit="contain"
        transition={0}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  interior: { position: 'absolute', overflow: 'hidden' },
  glass: { opacity: 0.38 },
});
