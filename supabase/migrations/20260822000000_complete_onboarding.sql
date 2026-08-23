-- ─────────────────────────────────────────────────────────────────────────────
-- complete_onboarding — the whole funnel lands in ONE transaction.
--
-- WHY THIS EXISTS
-- The client used to finish onboarding with four sequential round-trips:
--   updateProfile() → setGenrePrefs() → setReadingGoal() → completeOnboarding()
-- Any one of them failing left the reader authenticated but half-provisioned,
-- and nothing rolled back. Worse, the reverse order was also reachable: a
-- process death mid-flush (Android kills the app behind the Google browser tab
-- routinely) could stamp onboarding_completed_at onto a row with no name, no
-- genres and no goal — an account that boots straight to an empty home screen.
--
-- Same rule the gamification core already follows (complete_session): the
-- side effects of one user action belong in one transactional function.
--
-- ALSO: the COPPA age check moves server-side. The client age gate is a UX
-- affordance; this is the actual boundary. Under-13 cannot get a row here no
-- matter what the client sends. That is why signUp/signInWithGoogle no longer
-- write public.users at all — this function is the only door.
--
-- Idempotent: re-running (a retry, a resumed funnel) updates in place and never
-- moves the original completion timestamp.
--
-- Run: paste into Supabase SQL Editor, or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_onboarding(
  p_birth_year    smallint,
  p_display_name  text,
  p_genres        text[],
  p_goal_books    integer,
  p_theme         theme_pref default 'system',
  p_avatar_url    text       default null,
  p_tz_offset_min integer    default 0,
  p_tz_name       text       default 'UTC'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_age integer;
  v_row public.users%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- ── Validate before anything is written ───────────────────────────────────
  if p_birth_year is null then
    raise exception 'AGE_REQUIRED';
  end if;
  v_age := extract(year from now())::int - p_birth_year;
  if v_age < 13 then
    raise exception 'AGE_INELIGIBLE';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_goal_books is null or p_goal_books < 1 then
    raise exception 'GOAL_REQUIRED';
  end if;

  -- ── Identity + prefs + the completion stamp, together or not at all ───────
  -- On first insert trg_set_age_flags fills is_minor/is_under_13 from
  -- birth_year, and trg_provision_user seeds streaks + notification_settings.
  insert into public.users as u (
    id, birth_year, display_name, avatar_url, genre_prefs, theme,
    timezone_offset_minutes, timezone_name, onboarding_completed_at
  ) values (
    v_uid, p_birth_year, btrim(p_display_name), p_avatar_url,
    coalesce(p_genres, '{}'), p_theme, p_tz_offset_min, p_tz_name, now()
  )
  on conflict (id) do update set
    birth_year              = excluded.birth_year,
    display_name            = excluded.display_name,
    -- A resumed funnel may not re-upload the photo; don't wipe one already set.
    avatar_url              = coalesce(excluded.avatar_url, u.avatar_url),
    genre_prefs             = excluded.genre_prefs,
    theme                   = excluded.theme,
    timezone_offset_minutes = excluded.timezone_offset_minutes,
    timezone_name           = excluded.timezone_name,
    -- Re-running must not move the original completion date.
    onboarding_completed_at = coalesce(u.onboarding_completed_at, excluded.onboarding_completed_at),
    updated_at              = now()
  returning * into v_row;

  insert into public.reading_goals (user_id, year, goal_books)
  values (v_uid, extract(year from now())::smallint, p_goal_books)
  on conflict (user_id, year) do update
    set goal_books = excluded.goal_books, updated_at = now();

  return to_jsonb(v_row);
end; $$;

-- Same lockdown as the other client RPCs (20260811000000): authenticated only.
-- It derives the user from auth.uid() and rejects a null one, so it was never
-- forgeable — but anon has no legitimate reason to reach it.
revoke all on function public.complete_onboarding(smallint, text, text[], integer, theme_pref, text, integer, text) from public, anon;
grant execute on function public.complete_onboarding(smallint, text, text[], integer, theme_pref, text, integer, text) to authenticated;
