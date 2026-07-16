import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
    if (!reduceMotion) pressed.value = withTiming(0, { duration: 110 });
  };
  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View style={styles.outer}>
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
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
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
