import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}

const OFFSET = 4; // hard-shadow depth (px) the button presses into

// The hard shadow sits OUTSIDE the face (down-right by `offset`), so the block's
// visual extent is bigger than the face. If that extra lives outside the
// component's layout box it gets sliced off by any clipping ancestor — a vertical
// ScrollView clips horizontal overflow, which is why the review sheet's POST
// REVIEW button had a flat right edge. Reserving the overhang as padding on an
// outer wrapper keeps the whole block inside its own box, so no scroller can cut
// it, here or anywhere else it's used.
//
// Neubrutalist CTA. Flat accent fill, thick ink border, SHARP corners, and a
// hard offset shadow rendered as a solid ink block behind it. On press the
// button translates into its shadow (the shadow fades) for a tactile "stamp"
// feel. Ghost variant is a bordered transparent block, no shadow.
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const showShadow = !isDisabled;

  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pressed.value * OFFSET },
      { translateY: pressed.value * OFFSET },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));

  const onPressIn = () => {
    if (!reduceMotion) pressed.value = withTiming(1, { duration: 70 });
  };
  const onPressOut = () => {
    // PrimaryButton IS the primary action, so it always gets the spring-back
    // release — matching PressBlock's emphasis="primary". Kept in sync by hand
    // because this component predates PressBlock and re-implements the mechanic.
    if (!reduceMotion) pressed.value = withSpring(0, { damping: 15, stiffness: 220, mass: 1 });
  };
  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    // Outer box reserves the shadow's overhang so no scroller can clip it; the
    // inner stack is what the absolutely-placed shadow positions against.
    <View style={styles.outer}>
      <View style={styles.stack}>
      {showShadow ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.shadowBlock, { backgroundColor: t.ink }, shadowStyle]}
        />
      ) : null}
      <Animated.View style={moveStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          style={[
            styles.button,
            { borderColor: t.border },
            isPrimary
              ? { backgroundColor: t.accent }
              : { backgroundColor: t.bgSec },
            isDisabled && styles.disabled,
          ]}
        >
          <View style={styles.content}>
            {loading && (
              <ActivityIndicator
                size="small"
                color={isPrimary ? t.onAccent : t.text}
                style={styles.spinner}
              />
            )}
            <Text
              style={[
                styles.label,
                { color: isPrimary ? t.onAccent : t.text },
              ]}
            >
              {label.toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingRight: OFFSET, paddingBottom: OFFSET },
  stack: { position: 'relative' },
  shadowBlock: { position: 'absolute', top: OFFSET, left: OFFSET, right: -OFFSET, bottom: -OFFSET, borderRadius: RADIUS.lg },
  button: {
    minHeight: 52,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH_THICK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 8 },
  label: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, ...NO_FONT_PAD },
  disabled: { opacity: 0.45 },
});
