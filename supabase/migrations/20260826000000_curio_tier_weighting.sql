-- Curio tiers: make the roll favour whatever you have fewest of.
--
-- Duplicates now mean something — copies raise a curio through Found ->
-- Polished (3) -> Gilded (6) -> Luminous (12) — so a completed collection still
-- has somewhere to go. The tiers themselves are derived client-side from
-- user_curios.count, which is already server-owned, so there is no schema
-- change here. The only thing that has to move server-side is the weighting.
--
-- Before: unowned keys carried weight 3, every owned key carried 1, regardless
-- of how many copies you had. Past completion that is a uniform roll, so one
-- unlucky curio can sit at a single copy for months while others pile up.
--
-- Now the weight falls off with the count you already hold:
--
--   weight = 3 / (1 + 2 * count)
--
--   count 0 (unowned) -> 3      count 2 -> 0.60
--   count 1           -> 1      count 5 -> 0.27
--
-- which preserves the old 3:1 ratio between unowned and first-copy exactly, and
-- keeps tier progress spread evenly across the shelf instead of clumping.
--
-- Efraimidis-Spirakis samples by taking the largest random()^(1/weight), so the
-- exponent is the reciprocal: (1 + 2*count) / 3.

create or replace function public.open_pouch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_cost   constant int := 40;
  v_refund constant int := 12;
  v_weight constant numeric := 3;
  -- Mirrored client-side in components/curio/curios.ts, which maps these to art.
  -- Adding one here without adding it there ships an unrenderable curio.
  v_keys   constant text[] := array[
    'acorn','acorn-gold','berries','clover','egg','feather','lantern',
    'leaf','moonflower','mushroom','pebble','pinecone','snail'
  ];
  v_bal    int;
  v_key    text;
  v_dupe   boolean := false;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Spend first, conditionally, so two concurrent taps cannot both pass a
  -- balance check and overdraw. If the row does not match, they could not
  -- afford it and nothing has changed yet.
  update public.users
     set fireflies = fireflies - v_cost
   where id = v_uid
     and fireflies >= v_cost
  returning fireflies into v_bal;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', v_cost);
  end if;

  -- Weighted sample without replacement (Efraimidis-Spirakis): take the largest
  -- random()^(1/weight), where weight falls off with the count already held.
  select k.key into v_key
    from unnest(v_keys) as k(key)
    left join public.user_curios uc
      on uc.user_id = v_uid and uc.curio_key = k.key
   order by power(random(), (1.0 + 2 * coalesce(uc.count, 0)) / v_weight) desc
   limit 1;

  select true into v_dupe
    from public.user_curios
   where user_id = v_uid and curio_key = v_key;
  v_dupe := coalesce(v_dupe, false);

  insert into public.user_curios as uc (user_id, curio_key, count)
       values (v_uid, v_key, 1)
  on conflict (user_id, curio_key)
  do update set count = uc.count + 1
    returning uc.count into v_count;

  if v_dupe then
    update public.users
       set fireflies = fireflies + v_refund
     where id = v_uid
    returning fireflies into v_bal;
  end if;

  return jsonb_build_object(
    'ok',        true,
    'key',       v_key,
    'duplicate', v_dupe,
    'count',     v_count,
    'refunded',  case when v_dupe then v_refund else 0 end,
    'fireflies', v_bal
  );
end;
$$;

-- Unchanged from 20260825000000, restated because CREATE OR REPLACE keeps the
-- old ACL only if nothing else touches it — cheap to be explicit.
revoke all on function public.open_pouch() from public, anon;
grant execute on function public.open_pouch() to authenticated;
