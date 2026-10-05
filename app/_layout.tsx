import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LogBox, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { RootErrorBoundary } from '@/components/shared/RootErrorBoundary';

// Expo Router renders its own error screen in development but NOTHING in a
// release build — an uncaught render error anywhere in the tree just takes the
// app down. Exporting ErrorBoundary from the root layout is the framework's
// hook for catching it. Named `ErrorBoundary` because Expo Router looks that
// name up by convention.
export { RootErrorBoundary as ErrorBoundary };

// Expo Go (SDK 53+) dropped remote push, so expo-notifications' auto token
// registration logs a red console error on import. Push is properly guarded and
// works in dev/preview builds — this only silences the benign Expo-Go notice.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
]);
import { useFonts } from 'expo-font';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { ApiProvider } from '@/services/ApiContext';
import { liveApi } from '@/services/supabase';
import { useAppStore, hasHydratedPrefs, onPrefsHydrated } from '@/stores/appStore';
import { supabase } from '@/lib/supabase';
import { initAnalytics, identifyUser, resetAnalytics } from '@/lib/analytics';
import { registerForPushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useAppStore((s) => s.theme);
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  // Hold the splash until the persisted theme is back too, or a dark-mode reader
  // gets a flash of light paper before their preference lands.
  const [prefsReady, setPrefsReady] = useState(hasHydratedPrefs);
  useEffect(() => {
    const off = onPrefsHydrated(() => setPrefsReady(true));
    if (hasHydratedPrefs()) setPrefsReady(true); // finished before we subscribed
    return off;
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && prefsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, prefsReady]);

  // Analytics (B6): init once, then keep PostHog's distinct_id in sync with the
  // Supabase session — identify on sign-in, reset on sign-out. Centralized here
  // (the root never unmounts) so no screen has to manage it.
  useEffect(() => {
    initAnalytics();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        identifyUser(session.user.id);
        // Push token refresh (B5). Registration used to happen ONLY when the
        // Settings master toggle flipped on — but it defaults to on, so for
        // almost everyone that moment never comes and the server has no token to
        // target. onAuthStateChange also fires INITIAL_SESSION, so this covers a
        // cold launch with a restored session. Silent: never prompts.
        registerForPushNotifications(liveApi, { prompt: false });
        // Same moment, same reason: the streak cron reads the stored zone.
        liveApi.syncTimezone();
      } else resetAnalytics();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if ((!fontsLoaded && !fontError) || !prefsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ApiProvider api={liveApi}>
          <ThemeProvider preference={theme}>
            <ThemedStatusBar />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="session/[userBookId]"
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
              />
              {/* Review sits on the root stack above the tabs, like the tracker it
                  follows — back returns to the still-running session. Swipe-back is
                  left on deliberately: nothing has been saved yet, so retreating is
                  always safe. */}
              <Stack.Screen name="session/review" options={{ animation: 'slide_from_right' }} />
              {/* Book preview opened from search sits OVER the search sheet, so going
                  back returns to your results. That was always the behaviour, but only
                  by accident: a route pushed after a modal inherits presentation
                  'modal' (an iOS page sheet), and book.tsx compensated for the sheet's
                  inset without anything saying it was intended. Declared here, it is.
                  Every other entry stays unset ON PURPOSE — an explicit 'card' pushed
                  after a modal lands in the root controller BEHIND the modal. */}
              <Stack.Screen
                name="book"
                options={({ route }) => {
                  const from = (route.params as { from?: string } | undefined)?.from;
                  return from === 'search' || from === 'session_picker' ? { presentation: 'modal' } : {};
                }}
              />
              <Stack.Screen
                name="(modals)"
                options={{ presentation: 'transparentModal', animation: 'fade' }}
              />
            </Stack>
          </ThemeProvider>
        </ApiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Follows the RESOLVED theme, not the preference. Reading the preference sent
// 'system' down the 'light' branch every time, so a phone in light mode with
// System selected got white status-bar icons on light paper — clock and battery
// gone.
function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
