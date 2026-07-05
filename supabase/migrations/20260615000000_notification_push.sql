-- ─────────────────────────────────────────────────────────────────────────────
-- B5 — wire the streak/reminder cron to send pushes (blueprint §16).
--
-- The 20260610 cron jobs maintain streak/comeback STATE. This migration makes
-- them also enqueue a push at the right moments, and adds a daily reminder job.
-- Pushes go out through fn_send_push → pg_net → the send_push edge function,
-- which renders the template, respects each user's notification_settings, and
-- targets users.expo_push_token. Gating lives in the edge fn, so the SQL just
-- says "notify these users of this event" — users without a token / with the
-- type off are silently skipped.
--
-- Idempotency: pushes fire only on STATE TRANSITIONS (newly-at-risk, the run that
-- breaks a streak, the run that expires a comeback) or once per local reminder
-- hour — never every cron tick.
--
-- Run: AFTER 20260610_cron_streaks.sql. Needs pg_cron + pg_net. Then EDIT the two
-- placeholders in fn_send_push below:
--   __FUNCTIONS_URL__  e.g. https://<ref>.supabase.co/functions/v1
--   __PUSH_SECRET__    the value of: supabase secrets set PUSH_SEND_SECRET=...
-- ─────────────────────────────────────────────────────────────────────────────

-- Defensive: ensure the local-time helper exists (also defined in 20260610).
create or replace function public.fn_local_now(p_offset_min int)
returns timestamp language sql immutable as $$
  select (now() at time zone 'UTC') + (p_offset_min * interval '1 minute');
$$;

-- ── Push dispatch: POST to the send_push edge function via pg_net ──────────────
create or replace function public.fn_send_push(p_user_ids uuid[], p_type text, p_vars jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, net as $$
declare
  v_url    text := '__FUNCTIONS_URL__/send_push';
  v_secret text := '__PUSH_SECRET__';
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then return; end if;
  if v_url like '%__FUNCTIONS_URL__%' then
    raise notice 'fn_send_push: edit v_url / v_secret before it can deliver.';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('userIds', to_jsonb(p_user_ids), 'type', p_type, 'vars', p_vars)
  );
end; $$;

revoke execute on function public.fn_send_push(uuid[], text, jsonb) from public;

-- ── Break detection + comeback creation (+ push) ──────────────────────────────
create or replace function public.fn_evaluate_streaks()
returns void language plpgsql security definer set search_path = public as $$
declare
  r             record;
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
    if (v_local_today - r.last_read_local_date) >= 2 then
      if r.freeze_tokens > 0 then
        update public.streaks
          set freeze_tokens = freeze_tokens - 1, is_at_risk = false, updated_at = now()
          where user_id = r.user_id;
        insert into public.streak_freezes (user_id, used_on, source) values (r.user_id, v_local_today, 'token');
        continue;
      end if;

      update public.streaks
        set current_streak = 0, is_at_risk = false, updated_at = now()
        where user_id = r.user_id;

      if r.current_streak >= 3 then
        insert into public.comeback_challenges (user_id, streak_at_break, sessions_completed, started_at, expires_at)
          values (r.user_id, r.current_streak, 0, now(), now() + interval '3 days')
          on conflict (user_id) where (completed_at is null and expired_at is null) do nothing;
        -- Streak broke into a comeback window → nudge the recovery hook.
        perform public.fn_send_push(array[r.user_id], 'comeback_challenge_created', jsonb_build_object('N', r.current_streak));
      else
        perform public.fn_send_push(array[r.user_id], 'streak_broken', jsonb_build_object('N', r.current_streak));
      end if;
    end if;
  end loop;
end; $$;

-- ── At-risk flagging (+ push only on the false→true transition) ────────────────
create or replace function public.fn_flag_at_risk()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- Push to users who JUST crossed into at-risk this run (were not flagged yet,
  -- it's ≥18:00 local, and no session logged today). Doing this before the bulk
  -- update means each at-risk episode pushes exactly once.
  for r in
    select s.user_id, s.current_streak, u.timezone_offset_minutes as off
    from public.streaks s
    join public.users u on u.id = s.user_id
    where s.current_streak > 0 and s.is_at_risk = false
      and extract(hour from public.fn_local_now(u.timezone_offset_minutes)) >= 18
      and not exists (
        select 1 from public.reading_sessions rs
        where rs.user_id = s.user_id
          and rs.local_date = public.fn_local_now(u.timezone_offset_minutes)::date
      )
  loop
    perform public.fn_send_push(
      array[r.user_id], 'at_risk',
      jsonb_build_object('N', r.current_streak, 'X', 24 - extract(hour from public.fn_local_now(r.off))::int)
    );
  end loop;

  -- Now recompute the flag for everyone (also clears it once they read / next day).
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

-- ── Comeback expiry (+ push to those just expired) ────────────────────────────
create or replace function public.fn_expire_comebacks()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  with expired as (
    update public.comeback_challenges
      set expired_at = now()
      where completed_at is null and expired_at is null and now() > expires_at
      returning user_id
  )
  select array_agg(user_id) into v_ids from expired;

  if v_ids is not null then
    perform public.fn_send_push(v_ids, 'comeback_challenge_expired', '{}'::jsonb);
  end if;
end; $$;

-- ── Daily reminder (hourly; fires for each user in their local reminder hour) ──
create or replace function public.fn_daily_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select u.id as user_id, b.title, ubk.current_page
    from public.users u
    join public.notification_settings ns on ns.user_id = u.id
    left join lateral (
      select book_id, current_page, updated_at
      from public.user_books
      where user_id = u.id and status = 'reading'
      order by updated_at desc
      limit 1
    ) ubk on true
    left join public.books b on b.id = ubk.book_id
    where ns.enabled and ns.daily_reminder
      and extract(hour from public.fn_local_now(u.timezone_offset_minutes))::int = ns.daily_reminder_hour
      -- Don't nag if they already read today.
      and not exists (
        select 1 from public.reading_sessions rs
        where rs.user_id = u.id
          and rs.local_date = public.fn_local_now(u.timezone_offset_minutes)::date
      )
  loop
    perform public.fn_send_push(
      array[r.user_id], 'daily_reminder',
      jsonb_build_object('BookTitle', coalesce(r.title, 'your book'), 'N', coalesce(r.current_page, 1))
    );
  end loop;
end; $$;

revoke execute on function public.fn_daily_reminders() from public;

-- ── Schedule the daily reminder (the other three jobs already call the updated
--    functions by name, so they need no rescheduling). ─────────────────────────
do $sched$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'logos_daily_reminder';
    perform cron.schedule('logos_daily_reminder', '0 * * * *', 'select public.fn_daily_reminders();');
    raise notice 'logos_daily_reminder scheduled (edit fn_send_push placeholders to deliver).';
  else
    raise notice 'pg_cron NOT enabled — functions updated but daily reminder NOT scheduled.';
  end if;
end $sched$;
