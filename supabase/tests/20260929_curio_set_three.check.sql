-- Re-runnable check for 20260929000000_curio_set_three.sql against the LIVE DB.
-- One transaction that ROLLS BACK — nothing persists (not even the firefly top-up).
--   node dbrun.mjs --file supabase/tests/20260929_curio_set_three.check.sql
-- Every line of the final "out" must start with "ok". Uses a real tester account;
-- swap the id if that row ever goes away.
begin;
create temp table r(n serial, t text);
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;
update public.users set fireflies = 5000 where id = 'fa41abe2-9838-4345-83bb-489e49db4afc';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"fa41abe2-9838-4345-83bb-489e49db4afc","role":"authenticated"}';

do $$
declare i int; j jsonb; seen text[] := '{}'; stray int := 0;
begin
  for i in 1..80 loop
    j := public.open_pouch('epic');
    if (j->>'key') not like 'epic-%' then stray := stray + 1; end if;
    if not ((j->>'key') = any(seen)) then seen := seen || (j->>'key'); end if;
  end loop;
  insert into r(t) values (
    case when array_length(seen,1) = 13 and stray = 0 then 'ok' else 'FAIL' end
    || ' 80 epic pouches: ' || array_length(seen,1) || '/13 keys reached, ' || stray || ' out-of-set rolls');
end $$;

do $$
declare before int; after int;
begin
  select fireflies into before from public.users where id = auth.uid();
  begin
    perform public.open_pouch('nope');
    insert into r(t) values ('FAIL unknown set accepted');
  exception when others then
    insert into r(t) values ('ok unknown set raises: ' || sqlerrm);
  end;
  select fireflies into after from public.users where id = auth.uid();
  insert into r(t) values (case when before = after then 'ok unknown set charged 0' else 'FAIL charged ' || (before - after) end);
end $$;

do $$
declare j jsonb;
begin
  j := public.open_pouch('found');
  insert into r(t) values (case when (j->>'key') not like 'lit-%' and (j->>'key') not like 'epic-%'
    then 'ok found still rolls found: ' else 'FAIL found leaked: ' end || (j->>'key'));
  j := public.open_pouch('lit');
  insert into r(t) values (case when (j->>'key') like 'lit-%'
    then 'ok lit still rolls lit: ' else 'FAIL lit leaked: ' end || (j->>'key'));
  j := public.open_pouch();
  insert into r(t) values (case when (j->>'key') not like 'lit-%' and (j->>'key') not like 'epic-%'
    then 'ok legacy zero-arg still lands in set one: ' else 'FAIL legacy: ' end || (j->>'key'));
end $$;

reset role;
update public.users set fireflies = 10 where id = 'fa41abe2-9838-4345-83bb-489e49db4afc';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"fa41abe2-9838-4345-83bb-489e49db4afc","role":"authenticated"}';
do $$
declare j jsonb;
begin
  j := public.open_pouch('epic');
  insert into r(t) values (case when (j->>'reason') = 'insufficient' then 'ok insufficient refuses' else 'FAIL ' || j::text end);
end $$;
reset role;

insert into r(t)
  select 'ok acl: ' || coalesce(string_agg(distinct case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, ','), '-')
    from pg_proc p, aclexplode(p.proacl) a
   where p.proname = 'open_pouch' and pg_get_function_identity_arguments(p.oid) = 'p_set text'
     and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner;

select string_agg(t, E'\n' order by n) as out from r;
rollback;
