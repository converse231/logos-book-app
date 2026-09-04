import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/*
 * The app's ONE keyboard-avoidance strategy.
 *
 * `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`
 * — the shape this replaced — is a no-op on Android, so six screens (both auth
 * screens, two onboarding steps, Mood Reader, and the tracker's starting-page
 * sheet) had no avoidance there at all and leaned on the window mode instead.
 * `adjustPan` only guarantees the FOCUSED INPUT is visible, never the submit
 * button under it — on (onboarding)/account that button creates the account.
 *
 * Worse, the two strategies could not coexist. Reanimated's `useAnimatedKeyboard`
 * (already used by SheetScaffold and the Library search dock) calls
 * `WindowCompat.setDecorFitsSystemWindows(window, false)` ACTIVITY-WIDE on its
 * first subscriber and only restores it when the last one unmounts. Library calls
 * it at screen level and tab screens stay mounted, so after one visit the window
 * stops applying IME insets for the rest of the session — taking the pan/resize
 * fallback those six screens relied on with it.
 *
 * So: one strategy everywhere. Reanimated reports the live keyboard height on
 * both platforms and drives it on the UI thread, which is also the only path that
 * works inside a transparent modal window (where Android never resizes).
 * `app.json` drops `softwareKeyboardLayoutMode: "pan"` to match — nothing should
 * be moving the window underneath this.
 */

/** Live keyboard height as `paddingBottom`. Use on a container that owns the bottom edge. */
export function useKeyboardLift() {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));
}

/** Drop-in replacement for a `<KeyboardAvoidingView style={…}>` wrapper. */
export function KeyboardLift({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const lift = useKeyboardLift();
  return <Animated.View style={[style, lift]}>{children}</Animated.View>;
}
