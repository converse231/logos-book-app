-- ─────────────────────────────────────────────────────────────────────────────
-- Sign in with Apple — refresh tokens, kept ONLY so they can be revoked.
--
-- App Store Guideline 5.1.1(v): an app that offers Sign in with Apple and lets a
-- reader delete their account must also revoke the reader's Apple tokens
-- (https://appleid.apple.com/auth/revoke) when they do. The native flow hands
-- Supabase an identity token, which it does not keep, so Apple's refresh token
-- has to be obtained separately: the `apple_token` edge function trades the
-- one-time authorization code from the sign-in sheet for it and stores it here,
-- and `delete_account` revokes it before the account goes.
--
-- A refresh token is a live credential for the reader's Apple ID relationship
-- with this app, so this table is service-role only: RLS on with NO policies,
-- and every privilege revoked from the client roles (new tables otherwise still
-- inherit SELECT from the default privileges). Nothing in the app reads it.
--
-- Cascades with auth.users. delete_account reads and revokes FIRST, then deletes
-- the user — the cascade only tidies up afterwards.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.apple_refresh_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  -- The client_id the code was issued to (the bundle id). Revocation must use the
  -- same one, so it is stored rather than assumed.
  client_id     text not null,
  updated_at    timestamptz not null default now()
);

alter table public.apple_refresh_tokens enable row level security;

revoke all on table public.apple_refresh_tokens from public, anon, authenticated;
grant all on table public.apple_refresh_tokens to service_role;

comment on table public.apple_refresh_tokens is
  'Sign in with Apple refresh tokens, held only so delete_account can revoke them (Guideline 5.1.1(v)). Service role only.';
