-- ─────────────────────────────────────────────────────────────────────────────
-- Streak restores (decided 2026-08-04) — replaces the Comeback Challenge with a
-- TikTok-style model: 5 lifetime restores, spent by the user from a broken-streak
-- overlay, valid for 48h after the break, minimum 3-day streak.
--
-- Almost all of this already existed in the schema and was simply never wired:
-- `streaks.freeze_tokens` (always 0, nothing granted one) is the counter, and
-- `streak_freezes` is the audit log. The genuinely new part is remembering WHAT
-- broke, since fn_evaluate_streaks used to zero current_streak and lose it.
--
-- Comeback Challenges are NOT dropped — the table, the in-flight rows, and
-- complete_session's progress logic all stay so the three challenges currently
-- open can finish. This migration only stops NEW ones being created.
--
-- Run: after 20260620000000_remove_streak_grace.sql. No cron/secrets. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The restore budget ─────────────────────────────────────────────────────
-- The signup trigger inserts `public.streaks (user_id)` bare, so a column default
-- is all new accounts need.
alter table public.streaks alter column freeze_tokens set default 5;

-- Everyone who already exists sits at 0 because nothing has ever granted a token.
-- Guarded on = 0 so re-running can't top anyone back up after they've spent some.
update public.streaks set freeze_tokens = 5 where freeze_tokens = 0;

-- ── 2. Remember the break ─────────────────────────────────────────────────────
-- The overlay has to say "Restore your 25-day streak" and restore_streak has to
-- know what to put back. comeback_challenges.streak_at_break captured this before,
-- but only for streaks >= 3 and only while a challenge existed.
alter table public.streaks
  add column if not exists last_break_streak integer,
  add column if not exists last_break_at     timestamptz;

-- ── 3. Break detection ────────────────────────────────────────────────────────
-- Two behaviour changes from 20260615: freeze tokens are no longer spent
-- automatically (a restore is a choice the user makes from the overlay, not
-- something that happens silently overnight), and no new comeback challenge is
-- created.
create or replace function public.fn_evaluate_streaks()
returns void language plpgsql security definer set search_path = public as $$
declare
  r             record;
  v_local_today date;
begin
  for r in
    select s.user_id, s.current_streak, s.last_read_local_date,
           u.timezone_offset_minutes as off
    from public.streaks s
    join public.users u on u.id = s.user_id
    where s.current_streak > 0 and s.last_read_local_date is not null
  loop
    v_local_today := public.fn_local_now(r.off)::date;
    if (v_local_today - r.last_read_local_date) >= 2 then
      update public.streaks
        set current_streak    = 0,
            is_at_risk        = false,
            last_break_streak = r.current_streak,
            last_break_at     = now(),
            updated_at        = now()
        where user_id = r.user_id;

      perform public.fn_send_push(
        array[r.user_id], 'streak_broken', jsonb_build_object('N', r.current_streak)
      );
    end if;
  end loop;
end; $$;

-- ── 4. Spend a restore ────────────────────────────────────────────────────────
create or replace function public.restore_streak()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  st           public.streaks%rowtype;
  v_off        int;
  v_today      date;
  v_read_today boolean;
  v_new        int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select timezone_offset_minutes into v_off from public.users where id = v_uid;
  select * into st from public.streaks where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_streak');
  end if;

  -- Every rejection is named rather than boolean so the client can say why.
  if st.last_break_at is null or st.last_break_streak is null then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_restore');
  end if;
  if st.freeze_tokens <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_restores');
  end if;
  if now() > st.last_break_at + interval '48 hours' then
    return jsonb_build_object('ok', false, 'reason', 'window_closed');
  end if;
  if st.last_break_streak < 3 then
    return jsonb_build_object('ok', false, 'reason', 'streak_too_short');
  end if;

  v_today := public.fn_local_now(coalesce(v_off, 0))::date;
  v_read_today := exists (
    select 1 from public.reading_sessions where user_id = v_uid and local_date = v_today
  );

  -- A restore buys back the broken streak, never the present. If today hasn't been
  -- read yet, last_read lands on YESTERDAY so today still has to be earned — and
  -- the cron breaks it again tomorrow if it isn't. Anchoring on today-1 rather than
  -- on the specific missed day also means a two-day gap restores correctly instead
  -- of being re-broken by the next cron tick. If they already read today after the
  -- break, that day stacks on top.
  v_new := st.last_break_streak + (case when v_read_today then 1 else 0 end);

  update public.streaks set
    current_streak       = v_new,
    longest_streak       = greatest(longest_streak, v_new),
    last_read_local_date = case when v_read_today then v_today else v_today - 1 end,
    freeze_tokens        = freeze_tokens - 1,
    is_at_risk           = false,
    -- Nulling the break is what makes this single-use: a second call finds
    -- nothing_to_restore, so a double-tap can't spend two tokens.
    last_break_streak    = null,
    last_break_at        = null,
    updated_at           = now()
  where user_id = v_uid;

  insert into public.streak_freezes (user_id, used_on, source)
    values (v_uid, v_today, 'restore');

  return jsonb_build_object(
    'ok', true,
    'currentStreak', v_new,
    'restoresLeft', st.freeze_tokens - 1,
    'countedToday', v_read_today
  );
end; $$;

grant execute on function public.restore_streak() to authenticated;
