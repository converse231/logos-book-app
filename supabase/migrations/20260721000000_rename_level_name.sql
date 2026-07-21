-- ─────────────────────────────────────────────────────────────────────────────
-- Rebrand (Logos → Quire, 2026-07-21): rename the level-10 title
-- "Logos Legend" → "Quire Legend".
--
-- level_name is trigger-maintained and RECOMPUTED from a hardcoded ladder that
-- lives in TWO functions — fn_apply_xp (the XP trigger) and the delete_session RPC
-- — so both must be replaced or the name would recompute back to the old value.
-- Existing users already at the title are migrated once at the end.
--
-- The client `LevelName` type already expects 'Quire Legend'. Idempotent — safe to
-- re-run. Run in the Supabase SQL Editor, or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_apply_xp() returns trigger as $$
declare
  v_total bigint;
  v_level smallint;
  v_name  text;
begin
  update public.users
     set total_xp = total_xp + new.xp_amount
   where id = new.user_id
   returning total_xp into v_total;

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
     set level = v_level, level_name = v_name, updated_at = now()
   where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.delete_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
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
     set total_xp = v_total, level = v_level, level_name = v_name, updated_at = now()
   where id = v_uid;

  return jsonb_build_object('ok', true, 'totalXp', v_total, 'level', v_level, 'levelName', v_name);
end; $$;

grant execute on function public.delete_session(uuid) to authenticated;

-- Migrate anyone already sitting at the old title.
update public.users set level_name = 'Quire Legend' where level_name = 'Logos Legend';
