import { Stack } from 'expo-router';

// Nested stack so the Discover route registers as a single tab named `discover`
// (matching the Tabs.Screen options), consistent with home/library/profile.
export default function DiscoverStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
