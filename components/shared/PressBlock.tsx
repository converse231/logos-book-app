import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS } from '@/theme/tokens';

interface PressBlockProps {
  onPress: () => void;
  children: React.ReactNode;
  /** Applied to the front block — bg, border, radius:0, padding, layout. Do NOT
   *  include a boxShadow here; PressBlock renders the hard offset shadow itself.
   *  Keep layout margins OFF this (they'd misalign the shadow) — use containerStyle. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the outer wrapper — use for margins / alignSelf so the shadow
   *  stays aligned to the block. */
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  offset?: number; // hard-shadow depth (px) the block presses into
  /** Corner radius of the shadow block — match the front block's radius so the
   *  offset shadow's corners line up. Defaults to the universal soft radius. */
  radius?: number;
  haptic?: 'medium' | 'light' | 'none';
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean; busy?: boolean; selected?: boolean };
  hitSlop?: number;
}

// The canonical neubrutalist button interaction (same mechanic as PrimaryButton):
// a solid ink shadow block sits behind the content; on press the content
// translates INTO the shadow (which fades) for a tactile "stamp". Reduced-motion
// keeps the resting shadow and skips the travel. Wrap any block-style button with
// this so every CTA — steppers, FAB, Start Reading, share — feels identical.
export function PressBlock({
  onPress,
  children,
  style,
  containerStyle,
  disabled = false,
  offset = 4,
  radius = RADIUS.md,
  haptic = 'medium',
  accessibilityLabel,
  accessibilityState,
  hitSlop,
}: PressBlockProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);

  const moveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pressed.value * offset }, { translateY: pressed.value * offset }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));

  const onPressIn = () => {
    if (!reduce && !disabled) pressed.value = withTiming(1, { duration: 70 });
  };
  const onPressOut = () => {
    if (!reduce && !disabled) pressed.value = withTiming(0, { duration: 110 });
  };
  const handle = () => {
    if (disabled) return;
    if (haptic !== 'none') {
      Haptics.impactAsync(
        haptic === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    }
    onPress();
  };

  return (
    <View style={[styles.outer, containerStyle]}>
      {!disabled ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shadow,
            { top: offset, left: offset, right: -offset, bottom: -offset, backgroundColor: t.ink, borderRadius: radius },
            shadowStyle,
          ]}
        />
      ) : null}
      <Animated.View style={moveStyle}>
        <Pressable
          onPress={handle}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={accessibilityState}
          hitSlop={hitSlop}
          style={style}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  shadow: { position: 'absolute' },
});
