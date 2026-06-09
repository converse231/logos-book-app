import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { supabase } from '@/lib/supabase';

type Boot =
  | { phase: 'loading' }
  | { phase: 'onboarding' } // no session, or session without a finished profile
  | { phase: 'home' }; //       signed in + onboarding complete

// Boot redirect (B2). Resolves the auth session before routing:
//   • no session                        → onboarding (funnel ends in sign-up)
//   • session, onboarding NOT complete   → onboarding (finish the funnel)
//   • session + onboarding complete      → home
// A returning user reaches sign-in via the link on the age-gate / welcome screen.
export default function Index() {
  const t = useTheme();
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  useEffect(() => {
    let alive = true;

    const resolve = async (hasSession: boolean) => {
      if (!hasSession) {
        if (alive) setBoot({ phase: 'onboarding' });
        return;
      }
      // Session exists — has this user finished onboarding? Read the one column.
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed_at')
        .maybeSingle();
      if (!alive) return;
      const done = !error && !!data?.onboarding_completed_at;
      setBoot({ phase: done ? 'home' : 'onboarding' });
    };

    supabase.auth.getSession().then(({ data }) => resolve(!!data.session));

    // React to sign-in / sign-out that happen after first paint.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (boot.phase === 'loading') {
    // Splash is still up until fonts load in _layout; this matches the bg so the
    // brief auth check reads as part of the launch, not a flash.
    return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  }
  if (boot.phase === 'home') return <Redirect href={'/(tabs)/home' as Href} />;
  return <Redirect href={'/(onboarding)/age-gate' as Href} />;
}
