-- A second collection: pouches now roll from a named set.
--
-- Set two ("Out of the books") is eleven objects out of novels. Its keys are
-- prefixed `lit-`, and that prefix IS the set dimension — there is no set column
-- here and there should not be one. Set one keeps its bare keys because they are
-- already rows in public.user_curios; renaming them would be a data migration
-- for nothing.
--
-- Why per-set rolls rather than one hat of twenty-four: at ~9 fireflies a day a
-- 40-cost pouch already takes ~22 pouches to finish thirteen keys. Pooling both
-- sets roughly doubles that for BOTH collections at once, and the weighting that
-- kills the long tail (3 / (1 + 2*count), from 20260826000000) would spread
-- across two shelves, so neither would ever look close to done. The reader picks
-- the shelf; the server still picks the prize.
--
-- Nothing else about the economy moves: same cost, same duplicate refund, same
-- weighted draw, same single transaction, same conditional spend. Duplicates
-- still refund FIREFLIES and never XP — XP is the reading measure and drives
-- level_name, so a spendable currency must not be able to buy it.
--
-- open_pouch(p_set) is a NEW overload; the zero-arg open_pouch() is kept and
-- delegates to 'found' so builds already in the field keep working. p_set
-- deliberately has NO default — a default would make open_pouch() ambiguous
-- against the existing zero-arg function and break exactly those clients.

create or replace function public.open_pouch(p_set text)
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
  v_found  constant text[] := array[
    'acorn','acorn-gold','berries','clover','egg','feather','lantern',
    'leaf','moonflower','mushroom','pebble','pinecone','snail'
  ];
  -- Eleven, not thirteen: lit-diamond and lit-eye have no art yet. Add them here
  -- and in curios.ts together, or the server rolls something the app cannot draw.
  v_lit    constant text[] := array[
    'lit-boot','lit-bow','lit-goldfish','lit-harpoon','lit-horseshoe',
    'lit-notebook','lit-paintbox','lit-portrait','lit-silk-shirt',
    'lit-soma','lit-spectacles'
  ];
  v_keys   text[];
  v_bal    int;
  v_key    text;
  v_dupe   boolean := false;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_keys := case p_set
              when 'found' then v_found
              when 'lit'   then v_lit
            end;

  -- Before the spend, so a typo'd set never costs anybody fireflies.
  if v_keys is null then
    raise exception 'unknown curio set %', p_set;
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
  -- Scoped to this set's keys, so copies on the other shelf do not skew it.
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

-- Kept for builds already installed, which call open_pouch with no arguments.
create or replace function public.open_pouch()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select public.open_pouch('found');
$$;

revoke all on function public.open_pouch(text) from public, anon;
revoke all on function public.open_pouch() from public, anon;
grant execute on function public.open_pouch(text) to authenticated;
grant execute on function public.open_pouch() to authenticated;
