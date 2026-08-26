import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { hasPersistedSession, supabase } from '@/lib/supabase';
import {
  ONBOARDING_STEPS,
  firstIncompleteStep,
  useOnboardingStore,
} from '@/stores/onboardingStore';

type Boot =
  | { phase: 'loading' }
  | { phase: 'onboarding'; step: number }
  | { phase: 'home' }
  | { phase: 'error' };

// Boot redirect. Resolves the auth session before routing:
//   • no session                        → onboarding, at the first unanswered step
//   • session, no profile row           → onboarding (authenticated but never
//                                         provisioned — a Google user mid-funnel,
//                                         or an abandoned half-signup)
//   • session, onboarding NOT complete   → onboarding, at the first unanswered step
//   • session + onboarding complete      → home
//
// Resuming at the first UNANSWERED step (rather than always the age gate) is
// what makes an interrupted funnel survivable: the answers are persisted, so
// re-asking for a birth year the reader already gave is pure friction.
export default function Index() {
  const t = useTheme();
  const router = useRouter();
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // The persisted funnel store hydrates asynchronously; routing off it before
  // that finishes would send a returning reader back to step 0.
  const [hydrated, setHydrated] = useState(() => useOnboardingStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useOnboardingStore.persist.onFinishHydration(() => setHydrated(true));
    // Re-check AFTER subscribing. hasHydrated() is read once during the first
    // render, but this effect only runs after that render commits — hydration
    // finishing inside that gap fired onFinishHydration before anyone was
    // listening, so `hydrated` stayed false forever and boot never left
    // 'loading'. That is the blank screen some readers are stuck on.
    if (useOnboardingStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  const resumeStep = useCallback(() => firstIncompleteStep(useOnboardingStore.getState()), []);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;

    const resolve = async (hasSession: boolean) => {
      if (!hasSession) {
        // getSession() answers null for two very different situations: nobody
        // has ever signed in on this device, and there IS an account but the
        // token could not be refreshed right now (offline, flaky network, a
        // rejected rotation). Sending the second case to onboarding drops a
        // real reader on the account-creation step — which is what "I opened
        // the app and I was logged out" actually is. A session blob still on
        // disk means an account exists, so offer a retry instead.
        const stranded = await hasPersistedSession();
        if (!alive) return;
        setBoot(stranded ? { phase: 'error' } : { phase: 'onboarding', step: resumeStep() });
        return;
      }
      // Session exists — has this user been provisioned, and did they finish?
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed_at')
        .maybeSingle();
      if (!alive) return;
      if (error) {
        // A network blip is NOT "not onboarded". Dumping a real reader into the
        // funnel here risks them re-running it over a live account.
        setBoot({ phase: 'error' });
        return;
      }
      if (data?.onboarding_completed_at) setBoot({ phase: 'home' });
      else setBoot({ phase: 'onboarding', step: resumeStep() });
    };

    supabase.auth.getSession().then(({ data }) => resolve(!!data.session));

    // React to sign-in / sign-out that happen after first paint. INITIAL_SESSION
    // is skipped deliberately: getSession() above is the authoritative cold
    // read, and letting both drive the route means whichever resolves first
    // wins — including an early null that redirects to onboarding before the
    // stored session has even been read.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      resolve(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrated, attempt, resumeStep]);

  if (boot.phase === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={[styles.title, { color: t.text }]}>Can&rsquo;t reach Quire</Text>
        <Text style={[styles.body, { color: t.textSec }]}>
          Check your connection — your account and streak are safe.
        </Text>
        <Pressable
          onPress={() => {
            setBoot({ phase: 'loading' });
            setAttempt((n) => n + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={[styles.retry, { backgroundColor: t.accent, borderColor: t.border }]}
        >
          <Text style={[styles.retryText, { color: t.onAccent }]}>TRY AGAIN</Text>
        </Pressable>
        {/* Escape hatch. Retry covers a network blip, but a session that can
            never be refreshed again would otherwise strand the reader on this
            screen with no way forward. */}
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Sign in instead"
          hitSlop={10}
        >
          <Text style={[styles.altLink, { color: t.textSec }]}>Sign in instead</Text>
        </Pressable>
      </View>
    );
  }
  if (boot.phase === 'loading') {
    // Splash is still up until fonts load in _layout; this matches the bg so the
    // brief auth check reads as part of the launch, not a flash.
    return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  }
  if (boot.phase === 'home') return <Redirect href={'/(tabs)/home' as Href} />;
  return <Redirect href={ONBOARDING_STEPS[boot.step] as Href} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  title: { fontFamily: FONTS.displayBold, fontSize: 26, textAlign: 'center' },
  body: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: {
    marginTop: 12, paddingHorizontal: 28, height: 52, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  retryText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.6 },
  altLink: { fontFamily: FONTS.uiMedium, fontSize: 14.5, textDecorationLine: 'underline' },
});
