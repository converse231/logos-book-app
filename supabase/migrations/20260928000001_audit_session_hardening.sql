-- Release audit (2026-09-28) — server-side hardening. Additive except where noted.
--
-- Every cheat below was reproduced on the live DB as `authenticated`, in one
-- rolled-back transaction, before this was written:
--
--   30 calls to complete_session with local_date = last_read + 1, +2, … +30
--     → streak 0 → 30, last_read_local_date = 2026-10-09 (a date in the future,
--       which also means the cron can never break it). A phone whose clock is set
--       ahead produces the same state with no malice at all.
--   one session claiming pages 0 → 20000 over three hours → +10,210 XP
--   complete_session then delete_session, ten times → fireflies 25 → 390
--     (delete_session reversed the XP but never the fireflies)
--
-- complete_session trusted every number it was handed. "Server-authoritative"
-- only holds if the server also refuses input that cannot be true.

-- ── 1. Fireflies per session, so a delete can hand them back ─────────────────
alter table public.reading_sessions
  add column if not exists fireflies_awarded int not null default 0;
-- Sessions from before this column reverse 0 on delete — exactly today's
-- behaviour for them, so no backfill is needed to stay correct going forward.

-- ── 2. complete_session: validate, then reward at most 10 sessions a day ─────
-- Body is the live definition (== 20260823000000_fireflies.sql) plus:
--   * book_id / format come from the user_books row, never from the client
--   * timestamps: ended ≥ started, ≤ 24h long, not in the future, ≤ 14 days old
--   * local_date: not ahead of the latest calendar date anywhere on Earth, and
--     not more than a day before ended_at's own date — the only range a real
--     device can produce, including the offline queue replaying it days later
--   * pages / minutes: non-negative, a single session ≤ 2000 pages / 24h audio
--   * pph can't overflow numeric(7,2) any more (a 1-minute session could)
--   * a concurrent duplicate client_uuid dedupes instead of raising 23505
--   * only the first 10 sessions of a local day earn XP and fireflies. The
--     session, streak and badges still count — this only closes the loop where
--     "I read today" (0 pages, 0 seconds, +10 XP, +3 fireflies) could be tapped
--     forever. No honest reader logs eleven sessions in a day.
-- Rejections raise SQLSTATE 22023 with a SESSION_* message. The client treats
-- a 22xxx as permanent and drops it instead of retrying it from the queue.
create or replace function public.complete_session(
  p_client_uuid uuid, p_user_book_id uuid, p_book_id uuid, p_format book_format,
  p_started_at timestamptz, p_ended_at timestamptz, p_start_page int, p_end_page int,
  p_minutes_listened int, p_end_position_min int, p_local_date date, p_source session_source)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_rewarded_per_day constant int := 10;
  v_uid       uuid := auth.uid();
  v_ub        public.user_books%rowtype;
  v_format    book_format;
  v_existing  public.reading_sessions%rowtype;
  v_streak_cur int;
  v_duration  int;
  v_pages     int;
  v_minutes   int;
  v_pph       numeric;
  v_is_pb     boolean := false;
  v_rewarded  boolean;
  v_session   public.reading_sessions%rowtype;
  v_streak    jsonb;
  v_xp        int := 0;
  v_fire      int := 0;
  v_fire_tot  int := 0;
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
  select * into v_ub from public.user_books where id = p_user_book_id and user_id = v_uid;
  if not found then
    raise exception 'user_book % not found for this user', p_user_book_id using errcode = '22023';
  end if;
  -- The shelf row is the truth; a stale or forged client value can't mislabel stats.
  v_format := v_ub.format;

  select coalesce(current_streak,0) into v_streak_cur from public.streaks where user_id = v_uid;

  select * into v_existing from public.reading_sessions where user_id = v_uid and client_uuid = p_client_uuid;
  if found then
    return jsonb_build_object(
      'ok', true, 'deduped', true, 'sessionId', v_existing.id,
      'pagesRead', v_existing.pages_read, 'pph', v_existing.pph, 'durationSeconds', v_existing.duration_seconds,
      'isPersonalBest', v_existing.is_personal_best,
      'streak', jsonb_build_object('current', coalesce(v_streak_cur,0), 'incremented', false, 'restoredViaGrace', false),
      'xpGained', 0, 'newBadges', '[]'::jsonb, 'comeback', null, 'insight', null, 'milestoneVariant', null,
      'firefliesEarned', 0,
      'firefliesTotal', coalesce((select fireflies from public.users where id = v_uid), 0)
    );
  end if;

  -- ── Input that cannot be true is refused before anything is written ──────
  if p_started_at is null or p_ended_at is null or p_local_date is null then
    raise exception 'SESSION_INVALID: missing time fields' using errcode = '22023';
  end if;
  if p_ended_at < p_started_at or p_ended_at - p_started_at > interval '24 hours' then
    raise exception 'SESSION_INVALID: duration out of range' using errcode = '22023';
  end if;
  if p_ended_at > now() + interval '10 minutes' then
    raise exception 'SESSION_INVALID: ends in the future' using errcode = '22023';
  end if;
  if p_ended_at < now() - interval '14 days' then
    raise exception 'SESSION_TOO_OLD: sessions sync within 14 days' using errcode = '22023';
  end if;
  -- UTC+14 is the furthest-ahead zone and UTC-12 the furthest-behind, so these
  -- two bounds hold for every real device without knowing its timezone.
  if p_local_date > ((now() at time zone 'UTC') + interval '14 hours')::date
     or p_local_date < ((p_ended_at at time zone 'UTC') - interval '12 hours')::date then
    raise exception 'SESSION_INVALID: local_date does not match the session time' using errcode = '22023';
  end if;
  if coalesce(p_start_page, 0) < 0 or coalesce(p_end_page, 0) < 0
     or coalesce(p_end_page, 0) - coalesce(p_start_page, 0) > 2000
     or coalesce(p_minutes_listened, 0) not between 0 and 1440 then
    raise exception 'SESSION_INVALID: page or minute counts out of range' using errcode = '22023';
  end if;

  v_duration := greatest(0, extract(epoch from (p_ended_at - p_started_at))::int);
  if v_format = 'audiobook' then
    v_minutes := coalesce(p_minutes_listened, round(v_duration / 60.0)::int);
    v_pages := null;
    v_pph := null;
  else
    v_pages := greatest(coalesce(p_end_page, 0) - coalesce(p_start_page, 0), 0);
    v_minutes := null;
    v_pph := case when v_duration >= 60 then least(round(v_pages / (v_duration / 3600.0), 2), 99999.99) else null end;
  end if;

  v_rewarded := (select count(*) from public.reading_sessions
                  where user_id = v_uid and local_date = p_local_date) < c_rewarded_per_day;

  v_fire := case when v_rewarded then least(25, 3
    + floor(coalesce(v_pages, 0) / 10.0)::int
    + floor(coalesce(v_minutes, v_duration / 60.0) / 10.0)::int) else 0 end;

  v_is_pb := v_pages is not null and v_pages > 0
    and v_pages >= coalesce((select max(pages_read) from public.reading_sessions where user_id = v_uid), 0);

  insert into public.reading_sessions (
    user_id, user_book_id, book_id, format, started_at, ended_at, duration_seconds,
    start_page, end_page, pages_read, minutes_listened, pph, source, client_uuid, local_date,
    is_personal_best, fireflies_awarded
  ) values (
    v_uid, p_user_book_id, v_ub.book_id, v_format, p_started_at, p_ended_at, v_duration,
    case when v_format = 'audiobook' then null else p_start_page end,
    case when v_format = 'audiobook' then null else p_end_page end,
    v_pages, v_minutes, v_pph, coalesce(p_source, 'live'), p_client_uuid, p_local_date,
    v_is_pb, v_fire
  )
  on conflict (user_id, client_uuid) do nothing
  returning * into v_session;

  if not found then
    -- A concurrent call with the same client_uuid won the insert. Answer like
    -- the dedupe path rather than surfacing a unique violation.
    select * into v_existing from public.reading_sessions where user_id = v_uid and client_uuid = p_client_uuid;
    return jsonb_build_object(
      'ok', true, 'deduped', true, 'sessionId', v_existing.id,
      'pagesRead', v_existing.pages_read, 'pph', v_existing.pph, 'durationSeconds', v_existing.duration_seconds,
      'isPersonalBest', v_existing.is_personal_best,
      'streak', jsonb_build_object('current', coalesce(v_streak_cur,0), 'incremented', false, 'restoredViaGrace', false),
      'xpGained', 0, 'newBadges', '[]'::jsonb, 'comeback', null, 'insight', null, 'milestoneVariant', null,
      'firefliesEarned', 0,
      'firefliesTotal', coalesce((select fireflies from public.users where id = v_uid), 0)
    );
  end if;

  -- Book progress (format-aware); promote want/tbr/dnf → reading; stamp started_at.
  update public.user_books set
    current_page = greatest(current_page, coalesce(p_end_page, current_page)),
    current_position_min = greatest(current_position_min, coalesce(p_end_position_min, current_position_min)),
    status = case when status in ('want', 'tbr', 'dnf') then 'reading' else status end,
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = p_user_book_id;

  v_streak := public.fn_apply_streak(v_uid, p_local_date);

  if v_rewarded then
    v_amt := 10 + floor(coalesce(v_pages, v_minutes / 3.0, 0) * 0.5)::int;
    insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
      values (v_uid, 'session_complete', v_amt, jsonb_build_object('pagesRead', v_pages, 'minutes', v_minutes), v_session.id);
    v_xp := v_xp + v_amt;
  end if;

  if (v_streak->>'incremented')::boolean then
    v_amt := 20 + least((v_streak->>'current')::int, 50);
    insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
      values (v_uid, 'streak_day', v_amt, jsonb_build_object('streak', (v_streak->>'current')::int), v_session.id);
    v_xp := v_xp + v_amt;
  end if;

  if v_is_pb and v_rewarded then
    insert into public.xp_log (user_id, action_type, xp_amount, metadata, session_id)
      values (v_uid, 'personal_best', 50, '{}'::jsonb, v_session.id);
    v_xp := v_xp + 50;
  end if;

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

  v_insight := public.fn_generate_insight(v_uid, v_session.id, v_format);

  if (v_streak->>'incremented')::boolean then
    v_milestone := case (v_streak->>'current')::int
      when 365 then 'legendary' when 100 then 'cinematic' when 30 then 'bigger' when 7 then 'normal'
      when 50 then 'cinematic' when 200 then 'cinematic' when 500 then 'cinematic' when 1000 then 'cinematic'
      else null end;
  end if;

  update public.reading_sessions set xp_awarded = v_xp where id = v_session.id;

  update public.users set fireflies = coalesce(fireflies, 0) + v_fire
   where id = v_uid
   returning fireflies into v_fire_tot;

  return jsonb_build_object(
    'ok', true, 'deduped', false, 'sessionId', v_session.id,
    'pagesRead', v_pages, 'pph', v_pph, 'durationSeconds', v_duration,
    'isPersonalBest', v_is_pb, 'streak', v_streak, 'xpGained', v_xp,
    'newBadges', v_badges, 'comeback', v_comeback, 'insight', v_insight, 'milestoneVariant', v_milestone,
    'firefliesEarned', v_fire, 'firefliesTotal', coalesce(v_fire_tot, 0)
  );
end; $function$;

-- ── 3. delete_session hands the fireflies back too ──────────────────────────
-- Floors at zero: a reader who already spent them keeps the curio, they just
-- can't go negative. That's the same trade the XP side makes with levels.
create or replace function public.delete_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_sess  public.reading_sessions%rowtype;
  v_total bigint;
  v_level smallint;
  v_name  text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_sess from public.reading_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Reverse only what's directly tied to this session.
  delete from public.reading_insights where session_id = p_session_id and user_id = v_uid;
  delete from public.xp_log          where session_id = p_session_id and user_id = v_uid;
  delete from public.reading_sessions where id = p_session_id and user_id = v_uid;

  -- Recompute XP aggregates from the surviving ledger (mirrors fn_apply_xp's table).
  select coalesce(sum(xp_amount), 0) into v_total from public.xp_log where user_id = v_uid;
  select lvl, lname into v_level, v_name from (
    values
      (1,'Page Turner',0),(2,'Margin Scribbler',500),(3,'Chapter Chaser',1500),
      (4,'Shelf Builder',3500),(5,'Spine Cracker',7000),(6,'Night Reader',12000),
      (7,'Bibliophile',20000),(8,'Tome Raider',32000),(9,'Literary Athlete',50000),
      (10,'Quire Legend',80000)
  ) as t(lvl,lname,minxp)
  where v_total >= minxp
  order by minxp desc limit 1;

  update public.users
     set total_xp = v_total, level = v_level, level_name = v_name,
         fireflies = greatest(0, fireflies - coalesce(v_sess.fireflies_awarded, 0)),
         updated_at = now()
   where id = v_uid;

  return jsonb_build_object('ok', true, 'totalXp', v_total, 'level', v_level, 'levelName', v_name);
end; $function$;

-- CREATE OR REPLACE keeps existing grants; restated so this file stands alone.
revoke all on function public.complete_session(uuid, uuid, uuid, book_format, timestamptz, timestamptz, int, int, int, int, date, session_source) from public, anon;
grant execute on function public.complete_session(uuid, uuid, uuid, book_format, timestamptz, timestamptz, int, int, int, int, date, session_source) to authenticated;
revoke all on function public.delete_session(uuid) from public, anon;
grant execute on function public.delete_session(uuid) to authenticated;

-- ── 4. Grant hygiene ────────────────────────────────────────────────────────
-- TRUNCATE ignores RLS entirely, and Supabase's defaults hand it (plus TRIGGER
-- and REFERENCES) to anon/authenticated on every table. Nothing reachable over
-- PostgREST issues them today, so this is depth, not a live hole — but it is
-- one SECURITY INVOKER function with dynamic SQL away from being one.
do $$
declare t record;
begin
  for t in select c.oid::regclass as r from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') loop
    execute format('revoke truncate, trigger, references on %s from public, anon, authenticated', t.r);
  end loop;
end $$;

-- Future objects: new tables start with NO client writes and new functions with
-- NO client EXECUTE. Both holes this project has had (20260811 functions,
-- 20260826 tables) came from these defaults. A new client write or RPC now has
-- to be granted on purpose — which the checklist in CLAUDE.md already demands.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- SECURITY DEFINER trigger bodies with no pinned search_path. Their bodies are
-- fully schema-qualified, so pinning changes nothing but the hijack surface.
-- (EXECUTE is deliberately left alone — see 20260811000000.)
alter function public.fn_apply_xp() set search_path = public;
alter function public.fn_lock_minor_reviews() set search_path = public;
alter function public.fn_provision_user() set search_path = public;

-- ── 5. Bound what other readers get to see ──────────────────────────────────
-- display_name / avatar_url surface on OTHER people's screens through
-- public_profiles (review lists), and had no limits at all: a 1MB name, or an
-- avatar pointing at any URL on the internet (a tracking pixel on every reader
-- who opens that book's reviews). The client caps are 40 / 30 / 160 and the
-- live maxima are 20 / 11 / 42 / review 2062, so these fit every existing row.
alter table public.users
  add constraint users_display_name_len check (display_name is null or char_length(display_name) <= 60),
  add constraint users_username_len     check (username is null or char_length(username) <= 30),
  add constraint users_bio_len          check (bio is null or char_length(bio) <= 300),
  add constraint users_avatar_own_bucket check (
    avatar_url is null
    or avatar_url like 'https://gkigoeaycabiviuqfojd.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
  );
alter table public.reviews
  add constraint reviews_body_len check (body is null or char_length(body) <= 10000);

-- ── 6. Indexes ──────────────────────────────────────────────────────────────
-- delete_session filters on session_id, and deleting a session (or a book, or
-- an account) sets these FKs null — each a seq scan without an index.
create index if not exists xp_log_session_idx
  on public.xp_log (session_id) where session_id is not null;
create index if not exists reading_insights_session_idx
  on public.reading_insights (session_id) where session_id is not null;
-- Exact duplicates of a unique index (or its leading column): pure write cost.
drop index if exists public.books_google_idx;            -- = books_google_books_id_key
drop index if exists public.bestseller_list_idx;         -- = bestseller_lists_list_name_rank_key
drop index if exists public.idx_blocked_users_lookup;    -- = blocked_users unique (user_id, blocked_user_id)
drop index if exists public.ai_rec_cache_lookup;         -- leading cols = ai_rec_cache unique
drop index if exists public.user_ach_user_idx;           -- leading col of user_achievements unique
drop index if exists public.user_books_user_idx;         -- leading col of user_books unique + status idx

-- ── 7. The bestseller refresh was never scheduled ───────────────────────────
-- fn_sync_bestsellers is live (placeholders substituted) but cron.job has no
-- row for it, so Discover's "NYT Bestsellers" have been the 2026-06-06 lists
-- for four months. Wed + Sun 13:00 UTC, as 20260613000000 intended.
select cron.schedule('logos_bestsellers_sync', '0 13 * * 0,3', 'select public.fn_sync_bestsellers()');
