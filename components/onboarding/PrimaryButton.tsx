import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}

// Single primary CTA per screen (HIG `primary-action`). Press feedback within
// 100ms via subtle scale; haptic on press; spinner while async; never shifts
// layout. Min height 52 ≥ 44pt touch target.
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (!reduceMotion) scale.value = withTiming(0.97, { duration: 90 });
  };
  const onPressOut = () => {
    if (!reduceMotion) scale.value = withTiming(1, { duration: 120 });
  };
  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
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
          isPrimary
            ? { backgroundColor: t.accent }
            : { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.border },
          isDisabled && styles.disabled,
        ]}
      >
        <View style={styles.content}>
          {loading && (
            <ActivityIndicator
              size="small"
              color={isPrimary ? '#FFFFFF' : t.text}
              style={styles.spinner}
            />
          )}
          <Text
            style={[
              styles.label,
              { color: isPrimary ? '#FFFFFF' : t.text },
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 8 },
  label: { fontFamily: FONTS.uiSemiBold, fontSize: 16, letterSpacing: 0.2 },
  disabled: { opacity: 0.45 },
});
