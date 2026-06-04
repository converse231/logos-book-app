import { Stack } from 'expo-router';

// Nested stack so the More route registers as a single tab named `more`
// (matching the Tabs.Screen options), consistent with home/library/profile.
export default function MoreStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
