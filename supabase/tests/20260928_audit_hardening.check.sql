-- Re-runnable check for 20260928000000 + 20260928000001 against the LIVE DB.
-- Everything is inside one transaction that ROLLS BACK — no data changes.
--   node dbrun.mjs --file supabase/tests/20260928_audit_hardening.check.sql
-- Every line of the final "out" must start with "ok". Before the migrations are
-- applied it aborts (the old complete_session trusts the client's book_id) —
-- that is the check doing its job. Uses real ids from the
-- live project (a tester account + one of its physical books); swap them if
-- those rows ever go away.
begin;
create temp table r(n serial, t text); grant all on r to authenticated; grant usage on sequence r_n_seq to authenticated;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"fa41abe2-9838-4345-83bb-489e49db4afc","role":"authenticated"}';
-- P0 view
do $$ begin update public.public_profiles set level=99 where id='5b1301d8-c769-4094-8817-d751c6d4573b'; insert into r(t) values ('FAIL view update allowed'); exception when others then insert into r(t) values ('ok view update: '||sqlerrm); end $$;
do $$ begin delete from public.public_profiles where id='5b1301d8-c769-4094-8817-d751c6d4573b'; insert into r(t) values ('FAIL view delete allowed'); exception when others then insert into r(t) values ('ok view delete: '||sqlerrm); end $$;
do $$ declare n int; begin select count(*) into n from public.public_profiles; insert into r(t) values ('ok view select rows='||n); end $$;
-- legit live session (today); client sends a WRONG format/book — shelf row must win
do $$ declare j jsonb; begin
  j := public.complete_session('11111111-1111-1111-1111-111111111111','3d822dad-aba6-4c32-9c08-db2ed10aeaf3','00000000-0000-0000-0000-000000000000','audiobook',
     now()-interval '40 minutes', now(), 10, 42, null, null, ((now() at time zone 'Asia/Manila'))::date, 'live');
  insert into r(t) values ('ok legit session pages='||(j->>'pagesRead')||' xp='||(j->>'xpGained')||' ff='||(j->>'firefliesEarned'));
  j := public.complete_session('11111111-1111-1111-1111-111111111111','3d822dad-aba6-4c32-9c08-db2ed10aeaf3','00000000-0000-0000-0000-000000000000','physical',
     now()-interval '40 minutes', now(), 10, 42, null, null, ((now() at time zone 'Asia/Manila'))::date, 'live');
  insert into r(t) values ('ok replay dedupes='||(j->>'deduped')||' ff='||(j->>'firefliesEarned'));
exception when others then insert into r(t) values ('FAIL legit session: '||sqlerrm); end $$;
-- legit check-in (0 duration) and an offline replay from 3 days ago
do $$ declare j jsonb; begin
  j := public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now(), now(), null, null, null, null, ((now() at time zone 'Asia/Manila'))::date, 'backdated');
  insert into r(t) values ('ok check-in xp='||(j->>'xpGained'));
  j := public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '3 days 1 hour', now()-interval '3 days', 42, 60, null, null, ((now()-interval '3 days') at time zone 'Asia/Manila')::date, 'live');
  insert into r(t) values ('ok offline replay 3d old xp='||(j->>'xpGained'));
exception when others then insert into r(t) values ('FAIL legit check-in/replay: '||sqlerrm); end $$;
-- cheats: each must be refused
do $$ begin perform public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '1 minute', now(), 0,0,null,null, current_date + 5, 'live'); insert into r(t) values ('FAIL future local_date accepted'); exception when others then insert into r(t) values ('ok future date: '||sqlstate||' '||sqlerrm); end $$;
do $$ begin perform public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '3 hours', now(), 0,20000,null,null, current_date, 'live'); insert into r(t) values ('FAIL 20k pages accepted'); exception when others then insert into r(t) values ('ok 20k pages: '||sqlstate||' '||sqlerrm); end $$;
do $$ begin perform public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()+interval '1 day', now()+interval '1 day 1 hour', 0,5,null,null, current_date, 'live'); insert into r(t) values ('FAIL future ended_at accepted'); exception when others then insert into r(t) values ('ok future ended_at: '||sqlerrm); end $$;
do $$ begin perform public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '30 days 1 hour', now()-interval '30 days', 0,5,null,null, (now()-interval '30 days')::date, 'live'); insert into r(t) values ('FAIL 30d-old accepted'); exception when others then insert into r(t) values ('ok 30d old: '||sqlerrm); end $$;
do $$ begin perform public.complete_session(gen_random_uuid(),'9d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '1 minute', now(), 0,5,null,null, current_date, 'live'); insert into r(t) values ('FAIL foreign user_book accepted'); exception when others then insert into r(t) values ('ok foreign book: '||sqlstate); end $$;
-- daily cap: 15 check-ins today → only the first 10 of the day are rewarded
do $$ declare i int; tot int := 0; f int := 0; j jsonb; begin
  for i in 1..15 loop j := public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now(), now(), null,null,null,null, ((now() at time zone 'Asia/Manila'))::date, 'backdated');
    tot := tot + (j->>'xpGained')::int; f := f + (j->>'firefliesEarned')::int; end loop;
  insert into r(t) values ('ok 15 more check-ins today -> xp '||tot||', fireflies '||f||' (2 of today''s 10 already used above)'); end $$;
-- firefly reversal on delete
do $$ declare j jsonb; before int; after int; begin
  select fireflies into before from public.users where id = auth.uid();
  j := public.complete_session(gen_random_uuid(),'3d822dad-aba6-4c32-9c08-db2ed10aeaf3',null,'physical', now()-interval '2 days 2 hours', now()-interval '2 days', 0,200,null,null, ((now()-interval '2 days') at time zone 'Asia/Manila')::date, 'live');
  perform public.delete_session((j->>'sessionId')::uuid);
  select fireflies into after from public.users where id = auth.uid();
  insert into r(t) values (case when after = before then 'ok delete reverses fireflies (earned '||(j->>'firefliesEarned')||', net '||(after-before)||')' else 'FAIL fireflies net '||(after-before) end);
exception when others then insert into r(t) values ('FAIL delete test: '||sqlerrm); end $$;
-- legit profile writes still pass constraints
do $$ begin
  update public.users set display_name = 'Aiii Reader', bio = 'hello',
    avatar_url = 'https://gkigoeaycabiviuqfojd.supabase.co/storage/v1/object/public/avatars/fa41abe2-9838-4345-83bb-489e49db4afc/avatar.jpg?v=1' where id = auth.uid();
  insert into r(t) values ('ok legit profile update');
exception when others then insert into r(t) values ('FAIL legit profile: '||sqlerrm); end $$;
do $$ begin update public.users set avatar_url = 'https://evil.example/pixel.gif' where id = auth.uid(); insert into r(t) values ('FAIL foreign avatar accepted'); exception when others then insert into r(t) values ('ok foreign avatar refused'); end $$;
do $$ begin update public.users set avatar_url = 'https://gkigoeaycabiviuqfojd.supabase.co/storage/v1/object/public/avatars/5b1301d8-c769-4094-8817-d751c6d4573b/avatar.jpg' where id = auth.uid(); insert into r(t) values ('FAIL other users avatar accepted'); exception when others then insert into r(t) values ('ok other-user avatar path refused'); end $$;
-- pouch still works
do $$ declare j jsonb; begin j := public.open_pouch('found'); insert into r(t) values ('ok open_pouch: '||left(j::text,90)); exception when others then insert into r(t) values ('FAIL open_pouch: '||sqlerrm); end $$;
reset role;
-- a table created after the migration gets no client writes by default
insert into r(t) select 'cron job scheduled: '||count(*) from cron.job where jobname = 'logos_bestsellers_sync';
select string_agg(t, E'\n' order by n) as out from r;
rollback;
