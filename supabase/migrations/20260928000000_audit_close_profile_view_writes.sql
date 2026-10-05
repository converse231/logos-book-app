-- P0 — any signed-in user could rewrite or DELETE every other account.
--
-- public.public_profiles is a plain `select … from users where not is_minor`
-- view. Postgres makes a view like that AUTO-UPDATABLE, it is owned by
-- `postgres`, and it has no security_invoker — so a write through it runs with
-- the owner's rights and never meets users' RLS policy or the column lockdown
-- in 20260826000001. Supabase's default grants had handed `authenticated`
-- INSERT/UPDATE/DELETE on it, and PostgREST exposes it at /rest/v1/public_profiles.
--
-- Verified on the live DB before writing this, as `authenticated` with a
-- throwaway user's JWT, inside rolled-back transactions:
--
--   update public.public_profiles set level = 99, level_name = 'Quire Legend',
--     display_name = 'pwned' where id = '<another user>';        -- UPDATE 1
--   delete from public.public_profiles where id <> '<me>';       -- DELETE 16
--
-- The DELETE cascades through users → every owned table: one REST call wiped
-- every non-minor account and their sessions.
--
-- The view stays definer-rights for SELECT on purpose: reviewer names come from
-- it, and security_invoker would collapse that to "only your own row". So the
-- fix is the grants, not the view.

revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;

-- Verify (expect: both statements raise "permission denied for view public_profiles"):
--   begin;
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub":"<uid>","role":"authenticated"}';
--   update public.public_profiles set level = 99 where id <> '<uid>';
--   rollback;
