import { useEffect } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface PressChipProps {
  onPress: () => void;
  children: React.ReactNode;
  /** Drives the pop. Changing false → true springs the chip up and back. */
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * A small toggle that confirms a CHANGE, not just a touch.
 *
 * Chips carry state — the shelf status, a genre, a filter — so the motion's job is
 * to mark the moment the value changed, which is why the pop fires on `selected`
 * becoming true rather than on press. Tapping the already-selected chip stays
 * still: nothing changed, so nothing should move.
 *
 * The overshoot is deliberate here, unlike on the progress bar. A bar that
 * overshoots briefly shows a wrong number; a chip that overshoots just feels
 * picked.
 */
export function PressChip({ onPress, children, selected, style, accessibilityLabel }: PressChipProps) {
  const reduce = useReducedMotion();
  const press = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduce || !selected) return;
    // Underdamped: up ~6% and back. Snappier than the button release because a
    // chip is small and a slow settle on something this size reads as sluggish.
    pop.value = withSpring(1.06, { damping: 9, stiffness: 320, mass: 0.5 }, () => {
      pop.value = withSpring(1, { damping: 14, stiffness: 320, mass: 0.5 });
    });
  }, [selected, reduce, pop]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * (1 - press.value * 0.04) }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => {
          if (!reduce) press.value = withTiming(1, { duration: 70 });
        }}
        onPressOut={() => {
          if (!reduce) press.value = withTiming(0, { duration: 120 });
        }}
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
