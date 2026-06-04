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
// `detectSessionInUrl: false` — RN has no URL-based OAuth redirect like web.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
