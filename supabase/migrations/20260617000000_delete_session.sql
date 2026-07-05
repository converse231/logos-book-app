-- ─────────────────────────────────────────────────────────────────────────────
-- delete_session — let a reader remove a logged session from their history and
-- reverse ONLY what it directly contributed (blueprint §5, "no messed-up records").
--
-- Reverses:  the session row · its variable-reward insight(s) · its session-linked
--            XP ledger rows → then recomputes total_xp / level / level_name from
--            the surviving ledger (the XP trigger only fires on INSERT, so a delete
--            needs an explicit recompute).
-- Preserves: streak (no retroactive breaks), earned badges (earned stays earned),
--            and the book's current page (a furthest-reached position, not a
--            per-session value). Quantitative totals (pages / hours / session count
--            / avg pph) are derived from the session list, so they update for free.
--
-- Badge / comeback XP rows aren't session-linked, so they survive — consistent with
-- keeping the badge. SECURITY DEFINER + ownership check; idempotent (missing → ok:false).
--
-- Run: paste into Supabase SQL Editor, or `supabase db push`. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

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
      (10,'Logos Legend',80000)
  ) as t(lvl,lname,minxp)
  where v_total >= minxp
  order by minxp desc limit 1;

  update public.users
     set total_xp = v_total, level = v_level, level_name = v_name, updated_at = now()
   where id = v_uid;

  return jsonb_build_object('ok', true, 'totalXp', v_total, 'level', v_level, 'levelName', v_name);
end; $$;

grant execute on function public.delete_session(uuid) to authenticated;
