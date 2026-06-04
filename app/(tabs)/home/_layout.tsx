import { Stack } from 'expo-router';

// Nested stack so home/insights pushes WITHIN the Home tab instead of being
// registered as its own tab by the parent Tabs navigator.
export default function HomeStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
