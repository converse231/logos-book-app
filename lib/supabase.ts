import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL impl in RN
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
