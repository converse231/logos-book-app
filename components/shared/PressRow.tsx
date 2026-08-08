import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';

interface PressRowProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Wrapper style — the animated surface. Same split as PressBlock: anything the
   *  fill has to respect (border radius, flex) belongs here, not on `style`. */
  containerStyle?: StyleProp<ViewStyle>;
  /** [resting, pressed] background. Defaults to the card surface warming to the
   *  inset cream — override for rows that sit on a tinted fill. */
  tint?: [string, string];
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'checkbox' | 'radio' | 'switch';
  accessibilityState?: { disabled?: boolean; selected?: boolean; checked?: boolean; expanded?: boolean };
}

/**
 * A flat list row that responds to touch — More, Settings, book detail.
 *
 * These have no hard shadow to press into, so PressBlock's mechanic doesn't apply.
 * Instead the background warms to the inset cream and the row gives by 1.5%.
 *
 * Why not the old `pressed && { opacity }`: dimming the whole row, chip and text
 * included, reads as DISABLING it rather than pressing it — and RN's `pressed`
 * style is a hard swap with no transition, so it flickers on a fast tap. Driving
 * both properties through Reanimated gives an actual fade in and out.
 */
export function PressRow({
  onPress,
  children,
  style,
  containerStyle,
  tint,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: PressRowProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    // interpolateColor rather than an opacity fade, so the row lights UP instead
    // of dimming down.
    backgroundColor: interpolateColor(p.value, [0, 1], tint ?? [t.bgSec, t.bgTer]),
    transform: [{ scale: 1 - p.value * 0.015 }],
  }));

  return (
    // The wrapper carries ONLY the animated background and scale; `style` (layout,
    // padding, dividers) goes on the Pressable, which is what actually contains
    // the row's children. Putting layout on the wrapper would leave the flex row
    // on an element with nothing in it.
    <Animated.View style={[containerStyle, animStyle]}>
      <Pressable
        onPressIn={() => {
          if (!reduce && !disabled) p.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          if (!reduce && !disabled) p.value = withTiming(0, { duration: 160 });
        }}
        onPress={() => {
          if (disabled) return;
          Haptics.selectionAsync();
          onPress();
        }}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}


