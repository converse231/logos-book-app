-- Re-runnable check for 20261024000000_apple_refresh_tokens.sql against the LIVE DB.
-- One transaction that ROLLS BACK — nothing persists.
--   node dbrun.mjs --file supabase/tests/20261024_apple_refresh_tokens.check.sql
-- Every line of the final "out" must start with "ok". Uses a real tester account;
-- swap the id if that row ever goes away.
begin;
create temp table r(n serial, t text);
grant all on r to authenticated, anon;
grant usage on sequence r_n_seq to authenticated, anon;

-- Seed one row as the owner, so "can the reader see their OWN token" is a real test.
insert into public.apple_refresh_tokens(user_id, refresh_token, client_id)
values ('fa41abe2-9838-4345-83bb-489e49db4afc', 'check-token', 'com.quire.app')
on conflict (user_id) do update set refresh_token = excluded.refresh_token;

insert into r(t) select case when relrowsecurity then 'ok RLS enabled' else 'FAIL RLS off' end
  from pg_class where oid = 'public.apple_refresh_tokens'::regclass;

insert into r(t) select case when count(*) = 0 then 'ok no client-role privileges'
  else 'FAIL client roles hold: ' || string_agg(grantee || ':' || privilege_type, ', ') end
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'apple_refresh_tokens'
    and grantee in ('anon', 'authenticated', 'PUBLIC');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"fa41abe2-9838-4345-83bb-489e49db4afc","role":"authenticated"}';
do $$
begin
  perform 1 from public.apple_refresh_tokens;
  insert into r(t) values ('FAIL the owner could read their own token');
exception when insufficient_privilege then
  insert into r(t) values ('ok the owner cannot read it: ' || sqlerrm);
end $$;
do $$
begin
  insert into public.apple_refresh_tokens(user_id, refresh_token, client_id)
  values (auth.uid(), 'forged', 'com.quire.app');
  insert into r(t) values ('FAIL a client could write a token');
exception when insufficient_privilege then
  insert into r(t) values ('ok a client cannot write one: ' || sqlerrm);
end $$;

reset role;
set local role anon;
do $$
begin
  perform 1 from public.apple_refresh_tokens;
  insert into r(t) values ('FAIL anon could read tokens');
exception when insufficient_privilege then
  insert into r(t) values ('ok anon cannot read: ' || sqlerrm);
end $$;

reset role;
select string_agg(t, E'\n' order by n) as out from r;
rollback;
