import { Stack } from 'expo-router';

// Nested stack so profile/settings pushes WITHIN the Profile tab.
export default function ProfileStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
