-- ─────────────────────────────────────────────────────────────────────────────
-- Profile bio (shown on the profile page; edited in Settings). Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users add column if not exists bio text;
