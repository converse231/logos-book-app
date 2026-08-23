import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
  type StackCardInterpolationProps,
} from '@react-navigation/stack';
import { withLayoutContext } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

// JS-based stack bridged into expo-router so onboarding can use a card
// transition the native stack doesn't offer. Only onboarding uses it.
const { Navigator } = createStackNavigator();
const JsStack = withLayoutContext(Navigator);

// The hand-rolled push this replaces did three things that read as "off":
//   • it faded the INCOMING card up from opacity 0 while also sliding it a full
//     screen width — animating position and opacity together is what made the
//     motion feel washy rather than solid,
//   • it dimmed the outgoing card all the way to 0.35, so leaving a screen read
//     as the page dying rather than sliding underneath, and
//   • it ran on a 420ms timing curve, which is slow enough to notice as lag.
//
// forHorizontalIOS is the real thing: the outgoing card parallaxes to -30% with
// only a whisper of dim, the incoming card keeps full opacity, and a soft shadow
// tracks its leading edge so the two pages read as stacked sheets of paper —
// which is exactly the Paper & Ink metaphor. TransitionIOSSpec is a SPRING, not
// a timing curve, and that settle is most of what makes a native push feel
// expensive. Both come from the navigator we already depend on.
const SPEC = TransitionSpecs.TransitionIOSSpec;

// Reduced motion → a plain cross-fade, quick enough not to draw attention.
function fade({ current }: StackCardInterpolationProps) {
  return { cardStyle: { opacity: current.progress } };
}

export default function OnboardingLayout() {
  const reduce = useReducedMotion();
  const t = useTheme();
  return (
    <JsStack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        // React Navigation's own default card background is a light grey. It
        // would only ever show at the card's edge mid-slide, but that is exactly
        // where the eye is during a push.
        cardStyle: { backgroundColor: t.bg },
        // Keeps the page behind mounted and moving; without it the parallax has
        // nothing to parallax and you get a card sliding over a blank ground.
        detachPreviousScreen: false,
        cardStyleInterpolator: reduce ? fade : CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: reduce
          ? {
              open: { animation: 'timing', config: { duration: 160 } },
              close: { animation: 'timing', config: { duration: 160 } },
            }
          : { open: SPEC, close: SPEC },
      }}
    />
  );
}
