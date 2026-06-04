import { Stack } from 'expo-router';

// Nested stack so book detail ([userBookId]) and tbr push WITHIN the Library
// tab instead of becoming their own tabs.
export default function LibraryStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
