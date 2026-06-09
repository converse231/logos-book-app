import { StyleSheet, TextInput, TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import { FONTS } from '@/theme/tokens';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface SessionTimerProps {
  elapsedSec: SharedValue<number>;
  style?: TextStyle | TextStyle[];
}

function pad(n: number): string {
  'worklet';
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(totalSec: number): string {
  'worklet';
  const s = Math.floor(totalSec % 60);
  const m = Math.floor((totalSec / 60) % 60);
  const h = Math.floor(totalSec / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// The fine clock — formats an elapsed shared value (advanced by the tracker's
// useFrameCallback) entirely on the UI thread via animatedProps, so it never
// re-renders the tracker or stutters when the JS thread is busy. Tabular figures
// keep the digits from jittering.
export function SessionTimer({ elapsedSec, style }: SessionTimerProps) {
  const animatedProps = useAnimatedProps(() => {
    const text = formatClock(elapsedSec.value);
    return { text, defaultValue: text } as any;
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      animatedProps={animatedProps}
      style={[styles.clock, style]}
      accessibilityLabel="Reading time"
    />
  );
}

const styles = StyleSheet.create({
  clock: {
    fontFamily: FONTS.monoBold,
    fontSize: 68,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    textAlign: 'center',
    padding: 0,
  },
});
