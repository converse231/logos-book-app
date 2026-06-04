import { Stack } from 'expo-router';

// All modals use transparentModal presentation so they composite over the
// underlying screen (critical for session-complete celebrations, Section 3).
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'fade',
      }}
    />
  );
}
