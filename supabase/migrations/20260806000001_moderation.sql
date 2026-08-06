-- ─────────────────────────────────────────────────────────────────────────────
-- Moderation queue (2026-08-06). The reporting half shipped in 20260806000000;
-- this is the half where someone acts on the reports.
--
-- Admin is a flag on public.users rather than a separate role table: there is one
-- moderator (you), and a table with one row in it is a table you have to remember
-- exists. Promote with:
--   update public.users set is_admin = true where id = '<uuid>';
--
-- Run: Supabase SQL editor. No cron, no secrets.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists is_admin boolean not null default false;

-- Outcome of a report. Null = still in the queue.
alter table public.review_reports
  add column if not exists resolved_at     timestamptz,
  add column if not exists resolved_action text;

create index if not exists idx_review_reports_open
  on public.review_reports (created_at desc) where resolved_at is null;

-- SECURITY DEFINER so the policies below can read users.is_admin without
-- recursing through users' own RLS.
create or replace function public.fn_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

revoke execute on function public.fn_is_admin() from public;
grant execute on function public.fn_is_admin() to authenticated;

-- ── Admin reach ───────────────────────────────────────────────────────────────
-- Policies are permissive (OR'd), so each of these WIDENS access for admins only
-- and changes nothing for everyone else.

-- Read the whole queue, not just your own reports.
drop policy if exists admin_read_reports on public.review_reports;
create policy admin_read_reports on public.review_reports
  for select using (public.fn_is_admin());

-- Mark a report resolved.
drop policy if exists admin_resolve_reports on public.review_reports;
create policy admin_resolve_reports on public.review_reports
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Read any reported review. Needed because the reporting flow BLOCKS the author,
-- and the public_reviews policy hides blocked authors — without this an admin who
-- reported something could no longer see the thing they have to judge.
drop policy if exists admin_read_reviews on public.reviews;
create policy admin_read_reviews on public.reviews
  for select using (public.fn_is_admin());

-- Take content down.
drop policy if exists admin_delete_reviews on public.reviews;
create policy admin_delete_reviews on public.reviews
  for delete using (public.fn_is_admin());

-- Reporter display names come from public_profiles, same as the review list does.
