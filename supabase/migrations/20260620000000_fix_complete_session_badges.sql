-- ─────────────────────────────────────────────────────────────────────────────
-- HOTFIX — complete_session has been silently broken since 20260619000001.
--
-- That migration's complete_session body called public.fn_eval_badges(v_uid,
-- v_session.id) — a two-argument overload. That overload was only ever meant to
-- exist as part of an abandoned "60-second session undo" design (which needed
-- badge-XP rows stamped with session_id for a clean reversal); the client-side
-- undo feature was reverted in favor of an in-session Cancel button, but the
-- DB-side migration for it was never actually applied (its CREATE statements
-- never committed), so the live fn_eval_badges stayed the ORIGINAL one-argument
-- version. The 20260619000001 rewrite of complete_session copied the two-arg
-- call by mistake, referencing a function that doesn't exist.
--
-- plpgsql doesn't validate call signatures at CREATE FUNCTION time — only at
-- first execution — so this shipped silently: every complete_session call since
-- (every finished session AND every "I read today" check-in) has been throwing
-- "function fn_eval_badges(uuid, uuid) does not exist", which the client's
-- sendOrQueue() catches and treats as offline, silently queuing the session
-- locally instead of recording it. Confirmed via pg_proc: only the one-arg
-- fn_eval_badges(uuid) exists live; confirmed via a rolled-back transaction
-- test that calling complete_session reproduces this exact error.
--
-- Fix: revert that one call back to the one-arg form that actually exists.
-- Everything else in this function (the want/tbr/dnf promotion from 20260619000001)
-- is unchanged and correct.
--
-- Run: paste into Supabase SQL Editor, or `supabase db push`. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_session(
  p_client_uuid      uuid,
  p_user_book_id     uuid,
  p_book_id          uuid,
  p_format           public.book_format,
  p_started_at       timestamptz,
  p_ended_at         timestamptz,
  p_start_page       int,
  p_end_page         int,
  p_minutes_listened int,
  p_end_position_min int,
  p_local_date       date,
  p_source           public.session_source
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_existing  public.reading_sessions%rowtype;
  v_streak_cur int;
  v_duration  int;
  v_pages     int;
  v_minutes   int;
  v_pph       numeric;
  v_is_pb     boolean := false;
  v_session   public.reading_sessions%rowtype;
  v_streak    jsonb;
  v_xp        int := 0;
  v_amt       int;
  v_badges    jsonb := '[]'::jsonb;
  b           jsonb;
  v_comeback  jsonb := null;
  cc          public.comeback_challenges%rowtype;
  v_days_left int;
  v_insight   jsonb := null;
  v_milestone text := null;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.user_books where id = p_user_book_id and user_id = v_uid) then
    raise exception 'user_book % not found for this user', p_user_book_id;
  end if;

  select coalesce(current_streak,0) into v_streak_cur from public.streaks where user_id = v_uid;

  select * into v_existing from public.reading_sessions where user_id = v_uid and client_uuid = p_client_uuid;
  if found then
    return jsonb_build_object(
      'ok', true, 'deduped', true, 'sessionId', v_existing.id,
      'pagesRead', v_existing.pages_read, 'pph', v_existing.pph, 'durationSeconds', v_existing.duration_seconds,
      'isPersonalBest', v_existing.is_personal_best,
      'streak', jsonb_build_object('current', coalesce(v_streak_cur,0), 'incremented', false, 'restoredViaGrace', false),
      'xpGained', 0, 'newBadges', '[]'::jsonb, 'comeback', null, 'insight', null, 'milestoneVariant', null
    );
  end if;

  v_duration := greatest(0, extract(epoch from (p_ended_at - p_started_at))::int);
  if p_format = 'audiobook' then
    v_minutes := coalesce(p_minutes_listened, round(v_duration / 60.0)::int);
    v_pages := null;
    v_pph := null;
  else
    v_pages := greatest(coalesce(p_end_page, 0) - coalesce(p_start_page, 0), 0);
    v_minutes := null;
    v_pph := case when v_duration > 0 then round(v_pages / (v_duration / 3600.0), 2) else null end;
  end if;

  v_is_pb := v_pages is not null and v_pages > 0
    and v_pages >= coalesce((select max(pages_read) from public.reading_sessions where user_id = v_uid), 0);

  insert into public.reading_sessions (
    user_id, user_book_id, book_id, format, started_at, ended_at, duration_seconds,
    start_page, end_page, pages_read, minutes_listened, pph, source, client_uuid, local_date,
    is_personal_best
  ) values (
    v_uid, p_user_book_id, p_book_id, p_format, p_started_at, p_ended_at, v_duration,
    case when p_format = 'audiobook' then null else p_start_page end,
    case when p_format = 'audiobook' then null else p_end_page end,
    v_pages, v_minutes, v_pph, coalesce(p_source, 'live'), p_client_uuid, p_local_date,
    v_is_pb
  ) returning * into v_session;

  -- Book progress (format-aware); promote want/tbr/dnf → reading; stamp started_at.
  update public.user_books set
    current_page = greatest(current_page, coalesce(p_end_page, current_page)),
    current_position_min = greatest(current_position_min, coalesce(p_end_position_min, current_position_min)),
    status = case when status in ('want', 'tbr', 'dnf') then 'reading' else status end,
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = p_user_book_id;

  v_streak := public.fn_apply_streak(v_uid, p_local_date);

  v_amt := 10 + floor(coalesce(v_pages, v_minutes / 3.0, 0) * 0.5)::int;
  insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
    values (v_uid, 'session_complete', v_amt, jsonb_build_object('pagesRead', v_pages, 'minutes', v_minutes), v_session.id);
  v_xp := v_xp + v_amt;

  if (v_streak->>'incremented')::boolean then
    v_amt := 20 + least((v_streak->>'current')::int, 50);
    insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
      values (v_uid, 'streak_day', v_amt, jsonb_build_object('streak', (v_streak->>'current')::int), v_session.id);
    v_xp := v_xp + v_amt;
  end if;

  if v_is_pb then
    insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
      values (v_uid, 'personal_best', 50, '{}'::jsonb, v_session.id);
    v_xp := v_xp + 50;
  end if;

  -- FIX: one-arg form — this is the only fn_eval_badges that actually exists.
  v_badges := public.fn_eval_badges(v_uid);
  for b in select * from jsonb_array_elements(v_badges) loop
    v_xp := v_xp + coalesce((b->>'xpReward')::int, 0);
  end loop;

  select * into cc from public.comeback_challenges
    where user_id = v_uid and completed_at is null and expired_at is null for update;
  if found then
    if now() > cc.expires_at then
      update public.comeback_challenges set expired_at = now() where id = cc.id;
      v_comeback := jsonb_build_object('status', 'expired');
    else
      v_days_left := greatest(0, ceil(extract(epoch from (cc.expires_at - now())) / 86400.0)::int);
      if cc.sessions_completed + 1 >= 3 then
        update public.comeback_challenges
          set sessions_completed = 3, completed_at = now(), streak_restored = true where id = cc.id;
        update public.streaks set
          current_streak = cc.streak_at_break,
          longest_streak = greatest(longest_streak, cc.streak_at_break),
          last_read_local_date = p_local_date, updated_at = now()
        where user_id = v_uid;
        insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
          values (v_uid, 'comeback_restored', 75, jsonb_build_object('restoredTo', cc.streak_at_break), v_session.id);
        v_xp := v_xp + 75;
        v_streak := jsonb_build_object('current', cc.streak_at_break, 'incremented', true, 'restoredViaGrace', false);
        v_comeback := jsonb_build_object('status', 'completed', 'sessionsCompleted', 3, 'restoredTo', cc.streak_at_break);
      else
        update public.comeback_challenges set sessions_completed = sessions_completed + 1 where id = cc.id;
        v_comeback := jsonb_build_object('status', 'progress',
          'sessionsCompleted', cc.sessions_completed + 1, 'daysRemaining', v_days_left);
      end if;
    end if;
  end if;

  v_insight := public.fn_generate_insight(v_uid, v_session.id, p_format);

  if (v_streak->>'incremented')::boolean then
    v_milestone := case (v_streak->>'current')::int
      when 365 then 'legendary' when 100 then 'cinematic' when 30 then 'bigger' when 7 then 'normal'
      when 50 then 'cinematic' when 200 then 'cinematic' when 500 then 'cinematic' when 1000 then 'cinematic'
      else null end;
  end if;

  update public.reading_sessions set xp_awarded = v_xp where id = v_session.id;

  return jsonb_build_object(
    'ok', true, 'deduped', false, 'sessionId', v_session.id,
    'pagesRead', v_pages, 'pph', v_pph, 'durationSeconds', v_duration,
    'isPersonalBest', v_is_pb, 'streak', v_streak, 'xpGained', v_xp,
    'newBadges', v_badges, 'comeback', v_comeback, 'insight', v_insight, 'milestoneVariant', v_milestone
  );
end; $$;

grant execute on function public.complete_session(uuid, uuid, uuid, public.book_format, timestamptz, timestamptz, int, int, int, int, date, public.session_source) to authenticated;
