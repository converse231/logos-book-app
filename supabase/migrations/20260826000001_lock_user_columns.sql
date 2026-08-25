-- Stop the client writing its own progression.
--
-- FOUND BY AUDIT, 2026-08-26. public.users has one policy — `own_users` FOR ALL
-- USING (auth.uid() = id) — which is correct for row access but says nothing
-- about columns. Combined with a table-wide UPDATE grant, any signed-in user
-- could run:
--
--   update public.users set fireflies = 999999 where id = auth.uid();   -- verified
--   update public.users set is_admin  = true    where id = auth.uid();
--   update public.users set is_minor  = false   where id = auth.uid();
--
-- The first mints currency, the second is privilege escalation (fn_is_admin()
-- reads this column), and the third defeats the COPPA minor flag that RLS and
-- the review triggers depend on. total_xp / level / level_name / subscription
-- were all writable too, which makes the entire gamification core — the thing
-- the blueprint insists must be server-authoritative — client-authoritative in
-- practice.
--
-- Postgres note: column-level REVOKE cannot subtract from a table-level grant;
-- the two are additive. The only way to restrict columns is to drop the
-- table-wide UPDATE and re-grant the specific columns that should be writable.
--
-- SECURITY DEFINER functions (complete_session, open_pouch, complete_onboarding,
-- restore_streak, delete_session, the XP/streak triggers) execute as the owner
-- and are unaffected. They remain the only way these values can change, which
-- is the point.

revoke update on public.users from authenticated, anon;

-- Exactly what the client legitimately writes: the profile fields in
-- authApi.updateProfile, the push token in notificationApi.registerPushToken,
-- and local UI state. Everything omitted here is server-owned.
grant update (
  username,
  display_name,
  avatar_url,
  bio,
  theme,
  timezone_offset_minutes,
  timezone_name,
  expo_push_token,
  has_seen_swipe_hint,
  tooltip_seen_map,
  genre_prefs
) on public.users to authenticated;

-- anon has no business writing a user row at all; the grant above is
-- deliberately not mirrored for it.
