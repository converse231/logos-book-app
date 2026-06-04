import { Stack } from 'expo-router';

// Nested stack so the Stats route registers as a single tab named `stats`
// (matching the Tabs.Screen options), consistent with home/library/profile.
export default function StatsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
