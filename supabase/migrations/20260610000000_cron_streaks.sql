-- ─────────────────────────────────────────────────────────────────────────────
-- B4b — server-side streak lifecycle (blueprint §2.3 / §5). pg_cron jobs.
--
-- complete_session handles the READ path (increment + grace). These cron jobs
-- handle the ABSENCE path, which a client can't be trusted to run:
--   fn_evaluate_streaks  break a streak after a missed day; create a Comeback
--                        Challenge if the broken streak was ≥ 3 (the recovery hook)
--   fn_flag_at_risk      mark is_at_risk when local time passes 18:00 with no read
--   fn_expire_comebacks  expire comeback challenges past their 3-day window
--
-- Timezone rule (§2.3): jobs run hourly in UTC and compute each user's LOCAL
-- wall-clock date/hour from users.timezone_offset_minutes. All jobs are
-- idempotent (re-evaluate state, not deltas) so missed/duplicate runs are safe.
--
-- Push notifications are intentionally NOT fired here — that's B5 (no push infra
-- yet). These jobs only maintain streak/comeback STATE, which the app reads.
--
-- Run: paste into Supabase SQL Editor (enable pg_cron first: Dashboard → Database
-- → Extensions → pg_cron), or `supabase db push`. Idempotent + re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

-- Local wall-clock date/timestamp for a given UTC offset (minutes). Casting
-- (now() at time zone 'UTC') yields a tz-less UTC wall clock; adding the offset
-- gives the user's local wall clock independent of the session timezone.
create or replace function public.fn_local_now(p_offset_min int)
returns timestamp language sql immutable as $$
  select (now() at time zone 'UTC') + (p_offset_min * interval '1 minute');
$$;

-- ── Break detection + comeback creation (hourly) ──────────────────────────────
create or replace function public.fn_evaluate_streaks()
returns void language plpgsql security definer set search_path = public as $$
declare
  r           record;
  v_local_today date;
begin
  for r in
    select s.user_id, s.current_streak, s.last_read_local_date, s.freeze_tokens,
           u.timezone_offset_minutes as off
    from public.streaks s
    join public.users u on u.id = s.user_id
    where s.current_streak > 0 and s.last_read_local_date is not null
  loop
    v_local_today := public.fn_local_now(r.off)::date;
    -- Missed all of "yesterday" (local) → streak lapses.
    if (v_local_today - r.last_read_local_date) >= 2 then
      if r.freeze_tokens > 0 then
        -- Spend a freeze token instead of breaking (Phase 4 mechanic, honored now).
        update public.streaks
          set freeze_tokens = freeze_tokens - 1, is_at_risk = false, updated_at = now()
          where user_id = r.user_id;
        insert into public.streak_freezes (user_id, used_on, source) values (r.user_id, v_local_today, 'token');
        continue;
      end if;

      update public.streaks
        set current_streak = 0, is_at_risk = false, updated_at = now()
        where user_id = r.user_id;

      -- A meaningful broken streak (≥3) opens a 3-day Comeback Challenge.
      -- The partial unique index guarantees at most one active per user.
      if r.current_streak >= 3 then
        insert into public.comeback_challenges (user_id, streak_at_break, sessions_completed, started_at, expires_at)
          values (r.user_id, r.current_streak, 0, now(), now() + interval '3 days')
          on conflict (user_id) where (completed_at is null and expired_at is null) do nothing;
      end if;
    end if;
  end loop;
end; $$;

-- ── At-risk flagging (hourly) — self-correcting for all active streaks ────────
create or replace function public.fn_flag_at_risk()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.streaks s
    set is_at_risk = (
          extract(hour from public.fn_local_now(u.timezone_offset_minutes)) >= 18
          and not exists (
            select 1 from public.reading_sessions rs
            where rs.user_id = s.user_id
              and rs.local_date = public.fn_local_now(u.timezone_offset_minutes)::date
          )
        ),
        updated_at = now()
  from public.users u
  where u.id = s.user_id and s.current_streak > 0;
end; $$;

-- ── Comeback expiry (every 15 min) ────────────────────────────────────────────
create or replace function public.fn_expire_comebacks()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comeback_challenges
    set expired_at = now()
    where completed_at is null and expired_at is null and now() > expires_at;
end; $$;

-- Cron-only — never callable by clients.
revoke execute on function public.fn_evaluate_streaks() from public;
revoke execute on function public.fn_flag_at_risk() from public;
revoke execute on function public.fn_expire_comebacks() from public;

-- ── Schedule (requires pg_cron) ───────────────────────────────────────────────
do $sched$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Re-runnable: drop our jobs first, then (re)create.
    perform cron.unschedule(jobname) from cron.job where jobname like 'logos\_%';
    perform cron.schedule('logos_streak_eval',     '0 * * * *',    'select public.fn_evaluate_streaks();');
    perform cron.schedule('logos_at_risk',         '0 * * * *',    'select public.fn_flag_at_risk();');
    perform cron.schedule('logos_comeback_expiry', '*/15 * * * *', 'select public.fn_expire_comebacks();');
    raise notice 'LOGOS cron jobs scheduled.';
  else
    raise notice 'pg_cron NOT enabled — functions created but NOT scheduled. Enable pg_cron in Dashboard → Database → Extensions, then re-run this file.';
  end if;
end $sched$;
