-- ─────────────────────────────────────────────────────────────────────────────
-- B4 — complete_session: the server-authoritative gamification core (blueprint §2.2/§5).
--
-- ALL post-session side effects happen here in ONE transaction (a plpgsql function
-- is atomic — truer to the "single transaction, rollback on error" rule than a
-- Deno edge fn making N PostgREST calls). Idempotent on (user_id, client_uuid).
-- Called from the client via supabase.rpc('complete_session', {...}).
--
-- Helpers (all run inside the same transaction → still atomic):
--   fn_apply_streak      streak increment + 24h grace (§5)
--   fn_eval_badges       achievement unlock + badge XP (§5)
--   fn_generate_insight  variable-reward insight, seeded 30%/60% gate (§5/§6)
--
-- Run: paste into Supabase SQL Editor, or `supabase db push`. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Seed core achievements (idempotent) ──────────────────────────────────────
-- unlock_metric values must match the metric names computed in fn_eval_badges.
insert into public.achievements (slug, name, description, kind, icon_name, unlock_metric, unlock_threshold, xp_reward, sort_order) values
  ('first_session', 'First Steps',     'Complete your first reading session.',         'volume',      'footsteps', 'total_sessions', 1,    20,  1),
  ('pages_500',     'Getting Deep',    'Read 500 pages all-time.',                     'volume',      'book',      'total_pages',    500,  40,  2),
  ('pages_5000',    'Page Devourer',   'Read 5,000 pages all-time.',                   'volume',      'library',   'total_pages',    5000, 150, 3),
  ('streak_7',      'Week Strong',     'Hold a 7-day reading streak.',                 'streak',      'flame',     'streak_days',    7,    50,  4),
  ('streak_30',     'Month of Pages',  'Hold a 30-day reading streak.',                'streak',      'flame',     'streak_days',    30,   120, 5),
  ('streak_100',    'Century Reader',  'Hold a 100-day reading streak.',               'streak',      'flame',     'streak_days',    100,  300, 6),
  ('streak_365',    'Year of Words',   'Hold a 365-day reading streak.',               'streak',      'trophy',    'streak_days',    365,  1000,7),
  ('books_5',       'Shelf Starter',   'Finish 5 books.',                              'milestone',   'ribbon',    'books_finished', 5,    80,  8),
  ('books_25',      'Well Read',       'Finish 25 books.',                             'milestone',   'medal',     'books_finished', 25,   250, 9),
  ('consistent_30', 'Regular',         'Read on 30 different days.',                   'consistency', 'calendar',  'distinct_days',  30,   100, 10),
  ('speed_60',      'Quick Study',     'Hit 60 pages/hour in a session.',              'speed',       'flash',     'max_pph',        60,   60,  11)
on conflict (slug) do nothing;

-- ── Helper: streak increment with 24h grace (§5 apply_streak) ────────────────
create or replace function public.fn_apply_streak(p_uid uuid, p_local_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  st            public.streaks%rowtype;
  v_incremented boolean := false;
  v_restored    boolean := false;
begin
  select * into st from public.streaks where user_id = p_uid for update;
  if not found then
    insert into public.streaks (user_id) values (p_uid) returning * into st;
  end if;

  if st.last_read_local_date is null then
    st.current_streak := 1; v_incremented := true;
  elsif p_local_date = st.last_read_local_date then
    v_incremented := false;                                   -- 2nd session same day
  elsif p_local_date = st.last_read_local_date + 1 then
    st.current_streak := st.current_streak + 1; v_incremented := true;
  elsif p_local_date = st.last_read_local_date + 2
        and st.grace_used_on is distinct from (st.last_read_local_date + 1) then
    st.grace_used_on := st.last_read_local_date + 1;          -- 24h grace forgives one miss
    st.current_streak := st.current_streak + 1; v_incremented := true; v_restored := true;
  elsif p_local_date > st.last_read_local_date then
    st.current_streak := 1; v_incremented := true;            -- gap too large → fresh start
  else
    v_incremented := false;                                   -- backdate (B4a: no recompute)
  end if;

  if p_local_date >= coalesce(st.last_read_local_date, p_local_date) then
    st.last_read_local_date := greatest(coalesce(st.last_read_local_date, p_local_date), p_local_date);
  end if;
  st.longest_streak := greatest(st.longest_streak, st.current_streak);
  st.is_at_risk := false;
  st.updated_at := now();
  update public.streaks set
    current_streak = st.current_streak, longest_streak = st.longest_streak,
    last_read_local_date = st.last_read_local_date, grace_used_on = st.grace_used_on,
    is_at_risk = st.is_at_risk, updated_at = st.updated_at
  where user_id = p_uid;

  return jsonb_build_object('current', st.current_streak, 'incremented', v_incremented, 'restoredViaGrace', v_restored);
end; $$;

-- ── Helper: badge evaluator (§5) — unlocks + awards badge XP, returns new ─────
create or replace function public.fn_eval_badges(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m_streak    int;
  m_pages     bigint;
  m_sessions  bigint;
  m_days      bigint;
  m_finished  bigint;
  m_max_pph   numeric;
  a           record;
  v_value     numeric;
  v_new       jsonb := '[]'::jsonb;
begin
  select coalesce(current_streak,0) into m_streak from public.streaks where user_id = p_uid;
  select coalesce(sum(pages_read),0), count(*), count(distinct local_date), coalesce(max(pph),0)
    into m_pages, m_sessions, m_days, m_max_pph
    from public.reading_sessions where user_id = p_uid;
  select count(*) into m_finished from public.user_books where user_id = p_uid and status = 'finished';

  for a in select * from public.achievements where is_active loop
    if exists (select 1 from public.user_achievements ua where ua.user_id = p_uid and ua.achievement_id = a.id) then
      continue;
    end if;
    v_value := case a.unlock_metric
      when 'streak_days'    then coalesce(m_streak,0)
      when 'total_pages'    then coalesce(m_pages,0)
      when 'total_sessions' then coalesce(m_sessions,0)
      when 'distinct_days'  then coalesce(m_days,0)
      when 'books_finished' then coalesce(m_finished,0)
      when 'max_pph'        then coalesce(m_max_pph,0)
      else 0 end;
    if v_value >= a.unlock_threshold then
      insert into public.user_achievements (user_id, achievement_id, unlocked_at, progress_value)
        values (p_uid, a.id, now(), v_value)
        on conflict (user_id, achievement_id) do nothing;
      if a.xp_reward > 0 then
        insert into public.xp_log (user_id, action_type, xp_amount, metadata)
          values (p_uid, 'badge', a.xp_reward, jsonb_build_object('slug', a.slug));
      end if;
      v_new := v_new || jsonb_build_object(
        'id', a.id, 'slug', a.slug, 'name', a.name, 'description', a.description,
        'kind', a.kind, 'iconName', a.icon_name, 'lottieKey', a.lottie_key,
        'unlockThreshold', a.unlock_threshold, 'almostThereThreshold', a.almost_there_threshold,
        'xpReward', a.xp_reward, 'unlockedAt', now(), 'progressValue', v_value
      );
    end if;
  end loop;
  return v_new;
end; $$;

-- ── Helper: variable-reward insight (§5/§6) — seeded gate, real numbers only ──
create or replace function public.fn_generate_insight(p_uid uuid, p_session_id uuid, p_format public.book_format)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last      timestamptz;
  v_prob      numeric;
  v_seed      bigint;
  v_roll      numeric;
  v_pages     bigint;
  v_sessions  bigint;
  v_this      int;
  v_rank      bigint;
  v_recent    text[];
  v_cands     text[] := '{}';
  v_type      text;
  v_text      text;
  v_snap      jsonb := '{}'::jsonb;
  v_novels    int;
  ab          record;     -- active book for BOOK_PACE
  v_row       public.reading_insights%rowtype;
begin
  select max(shown_at) into v_last from public.reading_insights where user_id = p_uid;
  v_prob := case when v_last is null or now() - v_last > interval '7 days' then 0.60 else 0.30 end;

  -- deterministic per (user, session) so an offline re-sync can't reroll
  v_seed := abs(hashtextextended(p_uid::text || p_session_id::text, 42));
  v_roll := (v_seed % 100000)::numeric / 100000.0;
  if v_roll > v_prob then return null; end if;

  select pages_read into v_this from public.reading_sessions where id = p_session_id;
  select coalesce(sum(pages_read),0), count(*) into v_pages, v_sessions from public.reading_sessions where user_id = p_uid;
  select array_agg(insight_type::text) into v_recent
    from public.reading_insights where user_id = p_uid and shown_at > now() - interval '7 days';
  v_recent := coalesce(v_recent, '{}');

  -- Build candidate set from data gates (concrete-number types only).
  -- array_append (not ||) so an untyped string literal isn't parsed as an array.
  if v_pages >= 500 and not ('PAGE_MILESTONE' = any(v_recent)) then
    v_cands := array_append(v_cands, 'PAGE_MILESTONE');
  end if;
  if v_sessions >= 10 and v_this is not null and not ('BEST_SESSION' = any(v_recent)) then
    v_cands := array_append(v_cands, 'BEST_SESSION');
  end if;
  if p_format <> 'audiobook' and not ('BOOK_PACE' = any(v_recent)) then
    select ub.id, b.title, b.page_count, ub.current_page into ab
      from public.user_books ub join public.books b on b.id = ub.book_id
      where ub.user_id = p_uid and ub.status = 'reading' and b.page_count is not null
        and b.page_count > ub.current_page and v_this is not null and v_this > 0
      order by ub.updated_at desc limit 1;
    if found then v_cands := array_append(v_cands, 'BOOK_PACE'); end if;
  end if;

  if array_length(v_cands, 1) is null then return null; end if;
  v_type := v_cands[1 + (v_seed % array_length(v_cands, 1))];

  if v_type = 'PAGE_MILESTONE' then
    v_novels := greatest(1, round(v_pages / 320.0));
    v_text := format('You''ve now read %s pages — about %s average novels.', v_pages, v_novels);
    v_snap := jsonb_build_object('pages', v_pages, 'novels', v_novels);
  elsif v_type = 'BEST_SESSION' then
    select count(*) + 1 into v_rank from public.reading_sessions
      where user_id = p_uid and pages_read > v_this and id <> p_session_id;
    v_text := format('That was your #%s longest session ever — %s pages in one sitting.', v_rank, v_this);
    v_snap := jsonb_build_object('rank', v_rank, 'pages', v_this);
  else -- BOOK_PACE
    declare v_remaining int; v_days int;
    begin
      v_remaining := ab.page_count - ab.current_page;
      v_days := greatest(1, ceil(v_remaining::numeric / greatest(v_this, 1)));
      v_text := format('At your current pace, you''ll finish %s in about %s days.', ab.title, v_days);
      v_snap := jsonb_build_object('title', ab.title, 'days', v_days, 'remainingPages', v_remaining);
    end;
  end if;

  insert into public.reading_insights (user_id, session_id, insight_type, insight_text, data_snapshot, shown_at)
    values (p_uid, p_session_id, v_type::public.insight_type_enum, v_text, v_snap, now())
    returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id, 'sessionId', v_row.session_id, 'insightType', v_row.insight_type,
    'insightText', v_row.insight_text, 'dataSnapshot', v_row.data_snapshot,
    'shownAt', v_row.shown_at, 'wasShared', v_row.was_shared
  );
end; $$;

-- ── The transactional entry point ─────────────────────────────────────────────
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
  -- Ownership: the user_book must belong to the caller (SECURITY DEFINER bypasses RLS).
  if not exists (select 1 from public.user_books where id = p_user_book_id and user_id = v_uid) then
    raise exception 'user_book % not found for this user', p_user_book_id;
  end if;

  select coalesce(current_streak,0) into v_streak_cur from public.streaks where user_id = v_uid;

  -- Idempotency: same client_uuid → return the already-recorded session, no re-apply.
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

  -- Personal best (pages-based; audiobooks never PB on pages)
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

  -- Book progress (format-aware); promote want/dnf → reading; stamp started_at.
  update public.user_books set
    current_page = greatest(current_page, coalesce(p_end_page, current_page)),
    current_position_min = greatest(current_position_min, coalesce(p_end_position_min, current_position_min)),
    status = case when status in ('want', 'dnf') then 'reading' else status end,
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = p_user_book_id;

  -- Streak (with grace)
  v_streak := public.fn_apply_streak(v_uid, p_local_date);

  -- XP: session_complete + streak_day (if incremented) + personal_best
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

  -- Badges (awards their own XP rows; add their reward to the returned total)
  v_badges := public.fn_eval_badges(v_uid);
  for b in select * from jsonb_array_elements(v_badges) loop
    v_xp := v_xp + coalesce((b->>'xpReward')::int, 0);
  end loop;

  -- Comeback progress (§5): advance an active challenge; restore streak on 3rd session
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

  -- Variable reward (nullable)
  v_insight := public.fn_generate_insight(v_uid, v_session.id, p_format);

  -- Milestone celebration only when the streak just landed exactly on a tier
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
