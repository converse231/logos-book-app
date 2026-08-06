-- ─────────────────────────────────────────────────────────────────────────────
-- User-Generated Content compliance (Google Play), 2026-08-06.
--
-- reviews.is_public defaults true and every review in the app is readable by
-- everyone, which makes Quire a UGC app under Play policy. That policy requires an
-- in-app way to report objectionable content — and, in practice, for the reporter
-- to see the content actually go away.
--
-- Two tables, because they answer different questions:
--   review_reports  — the moderation queue YOU read (who flagged what, and why)
--   blocked_users   — whose content THIS reader never sees again
--
-- The hiding is enforced in RLS rather than in a client filter, so a block holds
-- everywhere reviews are read — the book-detail list, Home's carousel, and any
-- future surface — without each query having to remember.
--
-- Run: Supabase SQL editor. No cron, no secrets.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The moderation queue ──────────────────────────────────────────────────────
create table if not exists public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id)   on delete cascade,
  -- Free text rather than an enum: the reasons will change as you learn what
  -- people actually report, and an enum migration for that is not worth it.
  reason      text not null,
  created_at  timestamptz not null default now(),
  -- One report per person per review. Re-reporting is a no-op, not a way to
  -- inflate a count.
  unique (review_id, reporter_id)
);

create index if not exists idx_review_reports_review on public.review_reports(review_id);

alter table public.review_reports enable row level security;

-- A reporter may file and may see their own reports. Nobody reads anyone else's:
-- you moderate from the dashboard with the service role.
drop policy if exists own_reports on public.review_reports;
create policy own_reports on public.review_reports
  for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

-- ── Per-reader blocks ─────────────────────────────────────────────────────────
create table if not exists public.blocked_users (
  user_id         uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  -- Blocking yourself would silently hide your own reviews from you.
  constraint no_self_block check (user_id <> blocked_user_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists own_blocks on public.blocked_users;
create policy own_blocks on public.blocked_users
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Blocks actually hide things ───────────────────────────────────────────────
-- Replaces the plain `is_public = true` read policy. Your OWN reviews are still
-- covered by the separate own_reviews policy, so this can't hide them from you.
drop policy if exists public_reviews on public.reviews;
create policy public_reviews on public.reviews
  for select using (
    is_public = true
    and not exists (
      select 1 from public.blocked_users b
      where b.user_id = auth.uid()
        and b.blocked_user_id = reviews.user_id
    )
  );

create index if not exists idx_blocked_users_lookup on public.blocked_users(user_id, blocked_user_id);
