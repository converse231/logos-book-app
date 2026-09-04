import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

/*
 * The app's staged entrance: content lifts in from below, one block after the
 * next, so a screen assembles instead of appearing.
 *
 * This existed as thirteen private copies — three prop names (`i`, `d`, `index`)
 * and five different rhythms (55/60/70ms stagger, 420/440/460ms duration), none
 * of the variation meaning anything. Screens written after those copies simply
 * never got one, which is why Home, Library, Stats and Profile assembled and
 * Discover, the session screens, TBR and moderation just appeared.
 *
 * One rhythm now: STEP 65ms, DURATION 430ms — the median of what was already
 * there, so nothing shifts perceptibly.
 *
 * It reads `useReducedMotion()` itself rather than taking a `reduce` prop. That
 * prop-drilling was the reason two animated components shipped with no
 * reduced-motion path at all: a caller that forgets to pass it gets motion. A
 * caller that forgets to pass nothing cannot.
 */

const STEP_MS = 65;
const DURATION_MS = 430;

interface RevealProps {
  /** Position in the stagger. Delay is `index * STEP_MS`. */
  index?: number;
  /** Absolute delay in ms — for a beat hand-timed against another animation. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Reveal({ index, delay, style, children }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <View style={style}>{children}</View>;
  const ms = delay ?? (index ?? 0) * STEP_MS;
  return (
    <Animated.View style={style} entering={FadeInUp.delay(ms).duration(DURATION_MS)}>
      {children}
    </Animated.View>
  );
}
