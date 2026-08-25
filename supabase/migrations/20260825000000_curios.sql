-- Curios: the collection fireflies are spent on.
--
-- Thirteen forest-floor keepsakes. A pouch costs fireflies, rolls one item, and
-- refunds a little when it hands you something you already own.
--
-- The roll is server-side for the same reason streak and XP are: a client that
-- picks its own reward is not a reward. This is one transaction — spend, roll,
-- grant, refund — so it can never half-happen.
--
-- Tuning (expected values for a daily reader earning ~9 fireflies/day, 13 items):
--   cost 40, refund 12, unowned weighted 3x
--     -> a pouch every ~4.4 days, full set in ~2.9 months, ~22 pouches
--   Without the weighting the final item alone averages 13 pouches (~2 months
--   for one acorn), which is where collections die. The weight keeps duplicates
--   real but stops the tail being punishing.

create table if not exists public.user_curios (
  user_id        uuid        not null references public.users(id) on delete cascade,
  curio_key      text        not null,
  count          integer     not null default 1 check (count > 0),
  first_found_at timestamptz not null default now(),
  primary key (user_id, curio_key)
);

alter table public.user_curios enable row level security;

-- Read your own shelf. There is deliberately no insert/update/delete policy:
-- open_pouch is SECURITY DEFINER and is the only writer, so a client cannot
-- grant itself a curio even with a valid token.
drop policy if exists user_curios_select_own on public.user_curios;
create policy user_curios_select_own on public.user_curios
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------

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
  v_weight constant int := 3;
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
  -- random()^(1/weight). Unowned keys carry v_weight, owned carry 1.
  select k.key into v_key
    from unnest(v_keys) as k(key)
    left join public.user_curios uc
      on uc.user_id = v_uid and uc.curio_key = k.key
   order by power(random(), 1.0 / (case when uc.user_id is null then v_weight else 1 end)) desc
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

-- ponytail: not idempotent. Unlike complete_session there is no offline queue
-- replaying this — a pouch is a deliberate tap on a live connection — so the
-- client disabling the button while in flight covers the double-tap case. If
-- pouches ever get queued or auto-opened, add a client_uuid ledger here.

-- Match 20260811000000_lock_function_grants: nothing internal is callable by
-- anon, and only the deliberate entry points are callable by a signed-in user.
revoke all on function public.open_pouch() from public, anon;
grant execute on function public.open_pouch() to authenticated;
