import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL impl in RN
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Base project URL — tolerate a pasted REST endpoint (.../rest/v1/) or trailing slash.
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loud in dev — a missing env var otherwise surfaces as confusing auth errors.
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Check .env and restart Metro with `npx expo start -c`.'
  );
}

// Single shared client. Session persists in AsyncStorage (works in Expo Go).
// `detectSessionInUrl: false` — RN has no URL-based OAuth redirect like web, so the
// Google flow reads the deep link itself and exchanges the code by hand.
//
// `flowType: 'pkce'` is what makes that exchange safe on a mobile deep link: the
// redirect carries a short-lived CODE rather than the tokens themselves, so another
// app registering the same scheme can't lift a session out of the URL. supabase-js
// keeps the verifier in the storage adapter above. Password sign-in and the
// reset-password OTP are unaffected — flowType only governs OAuth and magic links.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// supabase-js can only refresh while a JS timer is alive, and React Native
// suspends timers in the background. Without this the token quietly expires
// while the app is away, and the NEXT cold start has to do a network refresh
// before it can answer "is this reader signed in?" — which is exactly the
// moment a flaky connection turns a signed-in reader into an apparent new one.
// This is the wiring Supabase's own React Native guide requires.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
// The app starts foregrounded; the listener above only fires on CHANGES.
supabase.auth.startAutoRefresh();

/** Where supabase-js keeps the session blob: sb-<project-ref>-auth-token. */
const PROJECT_REF = SUPABASE_URL.match(/^https:\/\/([^.]+)\./)?.[1] ?? '';
export const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

/**
 * Is there still a session on disk?
 *
 * getSession() returns null both for "this reader has never signed in" and for
 * "there IS a session but I could not refresh it just now". Those must not be
 * treated the same: the first belongs in onboarding, the second belongs in a
 * retry. A blob on disk means an account exists on this device.
 */
export async function hasPersistedSession(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTH_STORAGE_KEY)) != null;
  } catch {
    // Storage itself is unreadable — assume an account rather than shunting a
    // real reader into signup.
    return true;
  }
}
