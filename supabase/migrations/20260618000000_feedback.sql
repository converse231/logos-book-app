-- ─────────────────────────────────────────────────────────────────────────────
-- feedback — tester feedback + bug reports, stored for the app owner to review
-- during the test phase. Testers submit (and can read back) their own rows; the
-- owner reads everything via the dashboard / service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  kind        text not null default 'feedback' check (kind in ('bug','feedback','idea')),
  message     text not null check (char_length(btrim(message)) between 1 and 4000),
  app_version text,
  platform    text,
  created_at  timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists own_feedback_ins on public.feedback;
create policy own_feedback_ins on public.feedback for insert with check (auth.uid() = user_id);
drop policy if exists own_feedback_sel on public.feedback;
create policy own_feedback_sel on public.feedback for select using (auth.uid() = user_id);

grant select, insert on public.feedback to authenticated;
