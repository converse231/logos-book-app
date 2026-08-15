-- Lock down EXECUTE on the internal / SECURITY DEFINER functions.
--
-- WHY THIS EXISTS
-- Supabase's default privileges grant EXECUTE on everything in `public` to
-- `anon` and `authenticated`. Every gamification function here is SECURITY
-- DEFINER — it has to be, so it can write streaks and XP the caller's RLS
-- would refuse — which means the default grant handed the anon key the
-- ability to run them.
--
-- The anon key is not a secret: it ships inside the APK and sits in eas.json.
-- So "anon can execute" means "anyone on the internet can execute". Verified
-- against the live database before writing this, inside a rolled-back
-- transaction:
--
--   set local role anon;
--   select public.fn_apply_streak('<another user id>', current_date);
--   -- returned {"current": 19, ...}
--
-- That is someone else's streak, read and writable by an unauthenticated
-- caller. The same door was open on:
--
--   fn_send_push(uuid[], text, jsonb)  arbitrary push to any user, attacker-
--                                      chosen template and variables
--   fn_eval_badges(uuid)               grant anyone achievements
--   fn_generate_insight(uuid, ...)     fabricate insights
--   fn_daily_reminders()               fire the whole reminder batch on demand
--   fn_evaluate_streaks() / fn_flag_at_risk() / fn_expire_comebacks()
--                                      run the cron lifecycle out of band
--   fn_sync_bestsellers()              trigger the NYT sync repeatedly
--   fn_apply_xp() / fn_provision_user() / fn_lock_minor_reviews()
--                                      trigger bodies, never meant to be called
--
-- WHAT STAYS CALLABLE
-- Exactly the three RPCs the client actually invokes, and only for
-- `authenticated`. All three derive the user from auth.uid() and reject a null
-- one, so they were never forgeable — but anon has no legitimate reason to
-- reach them either, and revoking removes the need to trust that check.
--
-- WHAT IS DELIBERATELY LEFT ALONE
-- The five functions that return `trigger` — fn_apply_xp, fn_provision_user,
-- fn_lock_minor_reviews, fn_set_age_flags, fn_touch_updated_at. Postgres
-- refuses to call a trigger function directly ("trigger functions can only be
-- called as triggers"), so revoking EXECUTE on them buys nothing. It does
-- carry risk: fn_provision_user fires on auth.users insert as
-- supabase_auth_admin, whose access comes through PUBLIC, and revoking from
-- PUBLIC to gain nothing is a bad trade against breaking signup.

-- ── 1. Everything internal: no EXECUTE for anyone but the owner and cron ─────
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'fn_apply_streak', 'fn_daily_reminders', 'fn_eval_badges',
        'fn_evaluate_streaks', 'fn_expire_comebacks', 'fn_flag_at_risk',
        'fn_generate_insight', 'fn_send_push', 'fn_sync_bestsellers',
        'fn_local_now'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- ── 2. The three client RPCs: authenticated only ────────────────────────────
revoke all on function public.complete_session(uuid, uuid, uuid, book_format, timestamptz, timestamptz, int, int, int, int, date, session_source) from public, anon;
grant execute on function public.complete_session(uuid, uuid, uuid, book_format, timestamptz, timestamptz, int, int, int, int, date, session_source) to authenticated;

revoke all on function public.delete_session(uuid) from public, anon;
grant execute on function public.delete_session(uuid) to authenticated;

revoke all on function public.restore_streak() from public, anon;
grant execute on function public.restore_streak() to authenticated;

-- fn_is_admin() only ever reports on the CALLER, so it leaks nothing — but the
-- admin policies call it, and a policy is evaluated as the querying role, so
-- authenticated must keep EXECUTE or every moderation policy starts erroring.
revoke all on function public.fn_is_admin() from public, anon;
grant execute on function public.fn_is_admin() to authenticated;

-- ── 3. public_profiles: signed-in readers only ──────────────────────────────
-- A view runs with its OWNER's privileges unless security_invoker is set, so
-- this one bypasses the RLS on `users` by design — that's what lets a reader
-- resolve another reader's name on a review. Fine for signed-in users; it also
-- meant an unauthenticated anon-key holder could enumerate every non-minor
-- account's id, handle, display name, avatar and level. The app only ever
-- reads it while signed in.
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ── 4. Stop the defaults from re-opening this for anything added later ──────
alter default privileges in schema public revoke execute on functions from anon;
