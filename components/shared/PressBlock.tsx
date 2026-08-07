import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  /** 'primary' springs back past rest when released — one extra beat of life for
   *  the screen's main action. Everything else presses in and stops.
   *
   *  This is a hierarchy signal, not decoration: if every button overshoots, the
   *  overshoot stops meaning anything, and a Discard or Cancel that bounces
   *  playfully is saying the wrong thing. */
  emphasis?: 'primary' | 'secondary';
  haptic?: 'medium' | 'light' | 'none';
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean; busy?: boolean; selected?: boolean };
  hitSlop?: number;
}

// The hard shadow sits OUTSIDE the face (down-right by `offset`), so the block's
// visual extent is bigger than the face. If that extra lives outside the
// component's layout box it gets sliced off by any clipping ancestor — a vertical
// ScrollView clips horizontal overflow, which is why the review sheet's POST
// REVIEW button had a flat right edge. Reserving the overhang as padding on an
// outer wrapper keeps the whole block inside its own box, so no scroller can cut
// it, here or anywhere else it's used.
//
// Motion carries hierarchy: `emphasis="primary"` springs back past rest on
// release, everything else presses in and stops. Both travel into the shadow, so
// they read as one family — the primary just gets one extra beat.
//
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
  emphasis = 'secondary',
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
    if (reduce || disabled) return;
    if (emphasis === 'primary') {
      // Underdamped on purpose: damping ratio ~0.51, settling over roughly half a
      // second. What you feel is the RETURN CURVE, not the overshoot — with only
      // 4px of travel the overshoot is about 0.6px, well under a pixel. A crisp
      // 110ms snap and a slow springy release differ enormously in feel and barely
      // at all in distance.
      //
      // pressIn stays a timing: going down must feel definite and immediate.
      pressed.value = withSpring(0, { damping: 15, stiffness: 220, mass: 1 });
    } else {
      pressed.value = withTiming(0, { duration: 110 });
    }
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
    // `pad` reserves the shadow's overhang; `stack` is the positioning context the
    // absolutely-placed shadow measures against (see the note above).
    <View style={[{ paddingRight: offset, paddingBottom: offset }, containerStyle]}>
      <View style={styles.stack}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'relative' },
  shadow: { position: 'absolute' },
});
