import { Stack } from 'expo-router';

// One-question-per-screen linear flow with progress dots.
// Animation: slide_from_right for forward, pop_from_right (default back) for back.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    />
  );
}
