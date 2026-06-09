-- ─────────────────────────────────────────────────────────────────────────────
-- B2 — onboarding genre preferences.
-- The init schema (20260604000000) has no place to store a user's onboarding
-- genre picks (only books.genres exists). Add a text[] on users, captured at the
-- end of onboarding and used later for discover (P2) + AI recs (P3).
-- Additive + idempotent so it is safe to re-run against the live DB.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists genre_prefs text[] not null default '{}';

-- GIN index for future "readers who like X" lookups (discover/recs). Harmless now.
create index if not exists users_genre_prefs_gin on public.users using gin (genre_prefs);
