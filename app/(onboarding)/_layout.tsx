import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

// Onboarding stack.
//
// This used to bridge React Navigation's JS `createStackNavigator` into
// expo-router via `withLayoutContext`, purely to get `forHorizontalIOS` — the
// push where the outgoing card parallaxes to -30% with a whisper of dim, the
// incoming card holds full opacity, and a soft shadow tracks its leading edge,
// so the two pages read as stacked sheets of paper. SDK 56 severed expo-router
// from react-navigation (Metro now hard-errors on the import), so that bridge
// is gone.
//
// `ios_from_right` is the same transition done natively rather than emulated on
// the JS thread: same parallax, same leading-edge shadow, same spring settle,
// and it runs on both platforms. The three things the old hand-rolled version
// got wrong — fading the incoming card in while sliding it, dimming the outgoing
// card to 0.35, and a 420ms timing curve slow enough to read as lag — stay
// fixed, because none of them are what the platform does.
export default function OnboardingLayout() {
  const reduce = useReducedMotion();
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Onboarding is a guided sequence; swiping back out of it would skip
        // steps the next screen depends on.
        gestureEnabled: false,
        // The native stack's own background is a light grey. It only shows at
        // the card's edge mid-slide, which is exactly where the eye is.
        contentStyle: { backgroundColor: t.bg },
        // Reduced motion → a plain cross-fade, quick enough not to draw attention.
        animation: reduce ? 'fade' : 'ios_from_right',
      }}
    />
  );
}
