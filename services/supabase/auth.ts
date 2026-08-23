// ─────────────────────────────────────────────────────────────────────────────
// B2 — real auth + onboarding write-through (email-first).
//
// Flow (signup-last, decided 2026-06-08): the funnel is anonymous. welcome
// leads, then age-gate computes the COPPA flags client-side (no account yet);
// genres/goal/profile buffer into the persisted onboarding store. The account is
// created on the final `account` step: signUp() (or signInWithGoogle) makes the
// AUTH user only, then ONE call to completeOnboarding() writes public.users +
// reading_goals in a single transaction via the complete_onboarding RPC.
//
// Neither signUp nor signInWithGoogle touches public.users any more. That RPC is
// the only door, which is what lets the COPPA age check live server-side instead
// of depending on which caller remembered to pass a birth year.
//
// REQUIRES "Confirm email" OFF in Supabase → Auth → Providers → Email, so
// signUp returns an active session immediately (otherwise auth.uid() is null and
// the users insert is rejected by RLS). Magic-link/confirmation lands with the
// dev build later.
// ─────────────────────────────────────────────────────────────────────────────

import { decode } from 'base64-arraybuffer';
import type { QuireApi } from '../api';
import type { LevelName, SubStatus, ThemePref, UserProfile } from '../types';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

// Local device timezone, captured once at account creation. Streak/at-risk math
// (B4) buckets users by these; compute at signup, never re-derive server-side.
function localTimezone(): { offsetMinutes: number; name: string } {
  // getTimezoneOffset() returns minutes BEHIND UTC (e.g. UTC+8 → -480); invert
  // so a positive offset means ahead of UTC, matching timezone_offset_minutes.
  const offsetMinutes = -new Date().getTimezoneOffset();
  let name = 'UTC';
  try {
    name = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // Intl tz unavailable on some old engines — UTC fallback is harmless.
  }
  return { offsetMinutes, name };
}

// Maps a public.users row (snake_case) → UserProfile (camelCase) the UI binds to.
// `email` lives on auth.users, not this row — pass it in from the session.
function rowToProfile(r: Record<string, any>, email: string | null = null): UserProfile {
  return {
    id: r.id,
    email,
    username: r.username ?? null,
    displayName: r.display_name ?? null,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    genrePrefs: r.genre_prefs ?? [],
    birthYear: r.birth_year,
    isMinor: r.is_minor,
    isUnder13: r.is_under_13,
    theme: r.theme as ThemePref,
    timezoneOffsetMinutes: r.timezone_offset_minutes,
    timezoneName: r.timezone_name,
    totalXp: Number(r.total_xp ?? 0),
    level: r.level,
    levelName: r.level_name as LevelName,
    subscriptionStatus: r.subscription_status as SubStatus,
    onboardingCompletedAt: r.onboarding_completed_at ?? null,
    isAdmin: r.is_admin ?? false,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function currentUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

// Only the B2 method group. Composed over the mock in services/supabase/index.ts,
// so every not-yet-implemented method keeps falling through to the mock.
export const authApi: Partial<QuireApi> = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('Sign-in returned no user.');
    return { userId };
  },

  // Creates the AUTH user only. Provisioning public.users is completeOnboarding's
  // job — one door, so the COPPA check can't be routed around.
  async signUp(email, password) {
    const cleanEmail = email.trim();
    // RESUMABLE onboarding: a prior attempt may have created the account (and an
    // active session) but failed before the funnel was flushed. Reuse that
    // session instead of re-running signUp — which would error "User already
    // registered" and trap the user on the account screen forever.
    //
    // ONLY resume a session that belongs to THIS email. An abandoned Google
    // attempt also leaves a session behind, and adopting it here silently threw
    // away the credentials the user just typed and provisioned the account onto
    // the wrong (Google) identity — the "signed up with email, ended up in
    // someone else's account" bug.
    let { data: { session } } = await supabase.auth.getSession();
    const resumable =
      session?.user.email?.toLowerCase() === cleanEmail.toLowerCase() ? session.user.id : null;
    if (resumable) return { userId: resumable };
    if (session) {
      // A foreign leftover session (cancelled Google run). Clear it so the
      // signUp below starts from a clean slate rather than racing it.
      await supabase.auth.signOut();
    }

    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
    if (error) {
      // The address may already have an account (a prior partial attempt, or a
      // reinstall). Try the same credentials as a sign-in to recover in place.
      const { data: si } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (si.session?.user.id) return { userId: si.session.user.id };
      // Taken, and this password doesn't open it. A distinct code so the screen
      // can offer "sign in instead" rather than repeating a raw auth error —
      // this is the dead end an orphaned half-signup used to leave behind.
      if (/already|registered|exists/i.test(error.message)) throw new Error('EMAIL_IN_USE');
      throw error;
    }
    if (!data.session) {
      // Confirmation is ON — no active session, so completeOnboarding's insert
      // would be rejected by RLS. Fail loud with the fix.
      throw new Error(
        'Sign-up created the auth user but no session was returned. Turn OFF ' +
          '"Confirm email" in Supabase → Auth → Providers → Email for the email-first phase.'
      );
    }
    const userId = data.user?.id;
    if (!userId) throw new Error('Sign-up returned no user.');
    return { userId };
  },

  // ── Google (B5, brought forward for the Play Store launch) ──────────────────
  //
  // Browser OAuth rather than the native Google SDK, on purpose. The native path
  // needs an Android OAuth client keyed to your signing certificate's SHA-1 — and
  // once Play App Signing is on, the certificate that ships is Google's, not your
  // upload key. That mismatch is the classic "worked in preview, broken in
  // production" Google sign-in bug. This flow only ever uses the WEB client, which
  // has no fingerprint, so preview and production behave identically.
  //
  // PKCE: the redirect carries a short-lived code, not tokens, so another app
  // claiming the quire:// scheme can't lift a session out of the URL.
  async signInWithGoogle() {
    let { data: { session } } = await supabase.auth.getSession();

    // Resumable: an earlier attempt may have authenticated but died before the
    // funnel was flushed. Don't send them back through the browser for that.
    if (!session) {
      // createURL (not a hardcoded string) so this also resolves under Expo Go's
      // exp:// host, where the scheme isn't quire://.
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          // Always show the account chooser. Without this Google silently reuses
          // whichever account the device browser is already signed into, so a
          // reader who picked the wrong one had no way to change it — retrying
          // just re-authenticated the same account.
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Google sign-in could not start. Try again.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      // 'cancel' (back button) and 'dismiss' (swipe away) are both deliberate exits.
      if (result.type !== 'success') throw new Error('GOOGLE_CANCELLED');

      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (!code) {
        // Supabase reports provider failures on the redirect rather than throwing.
        const desc = url.searchParams.get('error_description') ?? url.searchParams.get('error');
        throw new Error(desc ? decodeURIComponent(desc) : 'Google sign-in did not complete.');
      }
      const { data: ex, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      session = ex.session;
    }

    const userId = session?.user.id;
    if (!userId) throw new Error('Google sign-in returned no user.');
    // No users row is written here — completeOnboarding owns provisioning, so a
    // Google user who never finishes the funnel stays profile-less and the boot
    // redirect keeps routing them through the age gate. That IS the COPPA
    // guarantee now, and it no longer depends on which caller passed what.
    return { userId };
  },

  async getAuthEmail() {
    return currentUserEmail();
  },

  async hasProfile() {
    const uid = await currentUserId();
    if (!uid) return false;
    const { data, error } = await supabase.from('users').select('id').eq('id', uid).maybeSingle();
    if (error) throw error; // caller decides — a network blip is not "no profile"
    return !!data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // OTP-code reset (not a link) so it works in Expo Go before deep links land (B5).
  // Requires the "Reset Password" email template to include {{ .Token }} — see the
  // dashboard step in CLAUDE.md's operational checklist.
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  },

  async resetPassword(email, code, newPassword) {
    // Recovery OTP → a live session; updateUser then sets the new password on it.
    const { error: vErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (vErr) throw vErr;
    const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
    if (uErr) throw uErr;
  },

  // ── Onboarding ──────────────────────────────────────────────────────────────
  async updateBirthYear(birthYear) {
    // Age-gate runs before any account exists — the COPPA decision is pure age
    // math, no round-trip. birth_year is persisted later by completeOnboarding,
    // which re-checks the age server-side; this is the UX half only.
    const age = new Date().getFullYear() - birthYear;
    return { isMinor: age < 18, isUnder13: age < 13 };
  },

  async updateProfile(dataIn) {
    const uid = await currentUserId();
    if (!uid) throw new Error('updateProfile requires an account — call signUp first.');
    const patch: Record<string, any> = {};
    if (dataIn.username !== undefined) patch.username = dataIn.username;
    if (dataIn.displayName !== undefined) patch.display_name = dataIn.displayName;
    if (dataIn.bio !== undefined) patch.bio = dataIn.bio;
    if (dataIn.theme !== undefined) patch.theme = dataIn.theme;
    if (dataIn.avatarUrl !== undefined) patch.avatar_url = dataIn.avatarUrl;
    const { data, error } = await supabase.from('users').update(patch).eq('id', uid).select().single();
    if (error) throw error;
    return rowToProfile(data, await currentUserEmail());
  },

  // Uploads a base64 JPEG to the public `avatars` bucket at avatars/<uid>/avatar.jpg
  // (upsert), returning a cache-busted public URL to store in users.avatar_url.
  async uploadAvatar(base64: string) {
    const uid = await currentUserId();
    if (!uid) throw new Error('uploadAvatar requires an account.');
    const path = `${uid}/avatar.jpg`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`; // bust CDN cache (same path on re-upload)
  },

  // One transaction for the whole funnel (20260822000000_complete_onboarding).
  // Identity + genres + goal + the completion stamp land together or not at all,
  // so a failure here can never leave a "completed" account with nothing in it.
  async completeOnboarding(data) {
    const uid = await currentUserId();
    if (!uid) throw new Error('completeOnboarding requires an account.');
    const tz = localTimezone();
    const { data: row, error } = await supabase.rpc('complete_onboarding', {
      p_birth_year: data.birthYear,
      p_display_name: data.displayName,
      p_genres: data.genres,
      p_goal_books: data.goalBooks,
      p_theme: data.theme ?? 'system',
      p_avatar_url: data.avatarUrl ?? null,
      p_tz_offset_min: tz.offsetMinutes,
      p_tz_name: tz.name,
    });
    if (error) {
      // The RPC's own guards come back as raw postgres messages; translate the
      // ones a reader can act on.
      if (/AGE_INELIGIBLE/.test(error.message)) {
        throw new Error('Quire is for readers 13 and up.');
      }
      throw error;
    }
    return rowToProfile(row as Record<string, any>, await currentUserEmail());
  },

  // ── User ──────────────────────────────────────────────────────────────────
  async getProfile() {
    const uid = await currentUserId();
    if (!uid) throw new Error('getProfile called with no session.');
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).single();
    if (error) throw error;
    return rowToProfile(data, await currentUserEmail());
  },
};
