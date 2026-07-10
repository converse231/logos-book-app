-- ─────────────────────────────────────────────────────────────────────────────
-- Remove the automatic 24h streak grace (decided 2026-06-18). The silent
-- auto-forgive made "7-day streak with a blank day" confusing. Now a missed day
-- breaks the streak honestly; recovery is the OPT-IN Comeback Challenge (already
-- built: cron creates it on break ≥3, complete_session restores it). No other
-- change — grace_used_on is left in place (now unused) and restoredViaGrace in the
-- result is simply never true.
--
-- Run: paste into the Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────

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
  elsif p_local_date > st.last_read_local_date then
    st.current_streak := 1; v_incremented := true;            -- missed a day → fresh start (no auto-grace)
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
