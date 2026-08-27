-- Set two's last two curios: lit-diamond and lit-eye.
--
-- 20260827000000 shipped eleven of the intended thirteen because those two had
-- no art yet, and rolling a key the client cannot draw lands the reader on
-- PouchReveal's "update the app" fallback. The art exists now, so the hat opens.
--
-- Everything else is byte-identical to 20260827000000 — same cost, same refund,
-- same weighting, same conditional spend, same set branch. Only v_lit changes.
-- Mirrored client-side in components/curio/curios.ts (LIT_KEYS + CURIOS).

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
  v_lit    constant text[] := array[
    'lit-boot','lit-bow','lit-diamond','lit-eye','lit-goldfish',
    'lit-harpoon','lit-horseshoe','lit-notebook','lit-paintbox',
    'lit-portrait','lit-silk-shirt','lit-soma','lit-spectacles'
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

revoke all on function public.open_pouch(text) from public, anon;
grant execute on function public.open_pouch(text) to authenticated;
