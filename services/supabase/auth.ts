// ─────────────────────────────────────────────────────────────────────────────
// B2 — real auth + onboarding write-through (email-first).
//
// Flow (signup-last, decided 2026-06-08): the funnel is anonymous. age-gate
// computes the COPPA flags client-side (no account yet); welcome/genres/goal
// buffer into the onboarding store. The account is created at the profile step:
// signUp() makes the auth user + the public.users row, then the screen flushes
// updateProfile / setGenrePrefs / setReadingGoal / completeOnboarding — all now
// authenticated writes (RLS: auth.uid() = id).
//
// REQUIRES "Confirm email" OFF in Supabase → Auth → Providers → Email, so
// signUp returns an active session immediately (otherwise auth.uid() is null and
// the users insert is rejected by RLS). Magic-link/confirmation lands with the
// dev build later.
// ─────────────────────────────────────────────────────────────────────────────

import { decode } from 'base64-arraybuffer';
import type { LogosApi } from '../api';
import type { LevelName, SubStatus, ThemePref, UserProfile } from '../types';
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
export const authApi: Partial<LogosApi> = {
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

  async signUp(email, password, birthYear) {
    const cleanEmail = email.trim();
    // RESUMABLE onboarding: a prior attempt may have created the account (and an
    // active session) but failed while flushing profile/prefs. Reuse that session
    // instead of re-running signUp — which would error "User already registered"
    // and trap the user on the profile screen forever.
    let { data: { session } } = await supabase.auth.getSession();
    let userId = session?.user.id ?? null;

    if (!userId) {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) {
        // The email may already exist (a prior partial attempt, or a reinstall).
        // Try to sign in with the same credentials to recover and continue.
        const { data: si } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!si.session) throw error; // can't recover → surface the original signUp error
        session = si.session;
        userId = si.user?.id ?? null;
      } else {
        userId = data.user?.id ?? null;
        if (!data.session) {
          // Confirmation is ON — no active session, so the users insert below would
          // be rejected by RLS. Fail loud with the fix.
          throw new Error(
            'Sign-up created the auth user but no session was returned. Turn OFF ' +
              '"Confirm email" in Supabase → Auth → Providers → Email for the email-first phase.'
          );
        }
        session = data.session;
      }
    }
    if (!userId) throw new Error('Sign-up returned no user.');

    // UPSERT the public.users row (idempotent — a prior attempt may have inserted
    // it). On first insert: trg_set_age_flags fills is_minor/is_under_13 from
    // birth_year; trg_provision_user seeds streaks + notification_settings. RLS: auth.uid() === id.
    const tz = localTimezone();
    const { error: insErr } = await supabase.from('users').upsert(
      {
        id: userId,
        birth_year: birthYear,
        timezone_offset_minutes: tz.offsetMinutes,
        timezone_name: tz.name,
      },
      { onConflict: 'id' }
    );
    if (insErr) throw insErr;
    return { userId };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // ── Onboarding ──────────────────────────────────────────────────────────────
  async updateBirthYear(birthYear) {
    // Age-gate runs before any account exists — the COPPA decision is pure age
    // math, no round-trip. birth_year is persisted later by signUp().
    const age = new Date().getFullYear() - birthYear;
    return { isMinor: age < 18, isUnder13: age < 13 };
  },

  async setGenrePrefs(genres) {
    const uid = await currentUserId();
    if (!uid) return; // mid-funnel, pre-account — buffered in the onboarding store
    const { error } = await supabase.from('users').update({ genre_prefs: genres }).eq('id', uid);
    if (error) throw error;
  },

  async setReadingGoal(year, goalBooks) {
    const uid = await currentUserId();
    if (!uid) {
      // Pre-account echo so the goal-projection screen has a value to render.
      return { id: 'pending', userId: 'pending', year, goalBooks, goalPages: null };
    }
    const { data, error } = await supabase
      .from('reading_goals')
      .upsert({ user_id: uid, year, goal_books: goalBooks }, { onConflict: 'user_id,year' })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, userId: data.user_id, year: data.year, goalBooks: data.goal_books, goalPages: data.goal_pages ?? null };
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

  async completeOnboarding() {
    const uid = await currentUserId();
    if (!uid) throw new Error('completeOnboarding requires an account.');
    const { error } = await supabase
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', uid);
    if (error) throw error;
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
