import { Easing } from 'react-native';
import { createStackNavigator, type StackCardInterpolationProps } from '@react-navigation/stack';
import { withLayoutContext } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

// JS-based stack bridged into expo-router so onboarding can use a custom card
// transition (the native stack only offers presets). Only onboarding uses it.
const { Navigator } = createStackNavigator();
const JsStack = withLayoutContext(Navigator);

const SPEC = {
  animation: 'timing' as const,
  config: { duration: 420, easing: Easing.bezier(0.22, 0.7, 0.15, 1) },
};

// Refined horizontal push: the incoming page slides in from the right and fades
// up; the page it covers parallaxes gently to the left and dims. Back navigation
// plays it in reverse automatically. Purely 2D — smooth and predictable.
function slidePush({ current, next, layouts }: StackCardInterpolationProps) {
  const { width } = layouts.screen;
  const covered = next != null;

  const enterX = current.progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0], extrapolate: 'clamp' });
  const enterOpacity = current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const coverX = covered
    ? next!.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.28], extrapolate: 'clamp' })
    : 0;
  const coverOpacity = covered
    ? next!.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35], extrapolate: 'clamp' })
    : 1;

  return {
    cardStyle: {
      transform: [{ translateX: covered ? coverX : enterX }],
      opacity: covered ? coverOpacity : enterOpacity,
    },
  };
}

// Reduced motion → a plain cross-fade.
function fade({ current }: StackCardInterpolationProps) {
  return { cardStyle: { opacity: current.progress } };
}

export default function OnboardingLayout() {
  const reduce = useReducedMotion();
  return (
    <JsStack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        cardStyleInterpolator: reduce ? fade : slidePush,
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
