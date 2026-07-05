-- ─────────────────────────────────────────────────────────────────────────────
-- B6 — NYT Bestsellers cache (Discover surface).
--
-- A server-side cache of New York Times bestseller lists, refreshed WEEKLY by
-- cron (the lists themselves only update weekly, and the NYT API is strictly
-- rate-limited — so we never call it from the client). The sync_bestsellers edge
-- function fetches NYT with the secret API key and upserts rows here; the client
-- only ever READS this table (world-readable, like public.books).
--
-- ToS: surfacing this data requires attributing "Data provided by The New York
-- Times" in the UI (the Discover carousel header does this).
--
-- Run: paste into the Supabase SQL Editor, or `supabase db push`. Idempotent.
-- For the weekly cron at the bottom you must (1) enable pg_cron + pg_net in
-- Dashboard → Database → Extensions, and (2) edit the two placeholders.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.bestseller_lists (
  id            uuid primary key default gen_random_uuid(),
  list_name     text not null,                 -- NYT encoded name, e.g. 'hardcover-fiction'
  list_display  text not null,                 -- human label, e.g. 'Hardcover Fiction'
  rank          smallint not null,
  title         text not null,
  author        text,
  isbn_13       text,
  cover_url     text,
  description   text,
  publisher     text,
  weeks_on_list smallint not null default 0,
  amazon_url    text,
  list_updated  date,                          -- NYT bestsellers_date for this list
  synced_at     timestamptz not null default now(),
  unique (list_name, rank)
);
create index if not exists bestseller_list_idx on public.bestseller_lists (list_name, rank);

-- World-readable; writes happen only via the service role (RLS bypassed), exactly
-- like public.books. No client INSERT/UPDATE policy ⇒ clients can read but not write.
alter table public.bestseller_lists enable row level security;
drop policy if exists read_bestsellers on public.bestseller_lists;
create policy read_bestsellers on public.bestseller_lists for select using (true);

-- ── Weekly refresh via pg_cron → pg_net → sync_bestsellers edge function ───────
-- The edge function holds the NYT key; cron just pokes it. Edit the placeholders:
--   __FUNCTIONS_URL__  your Functions base, e.g. https://<ref>.supabase.co/functions/v1
--   __SYNC_SECRET__    the value of: supabase secrets set BESTSELLERS_SYNC_SECRET=...
create or replace function public.fn_sync_bestsellers()
returns void language plpgsql security definer set search_path = public, net as $$
declare
  v_url    text := '__FUNCTIONS_URL__/sync_bestsellers';
  v_secret text := '__SYNC_SECRET__';
begin
  if v_url like '%__FUNCTIONS_URL__%' then
    raise notice 'fn_sync_bestsellers: edit v_url / v_secret in this function before scheduling.';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    body    := '{}'::jsonb
  );
end; $$;

revoke execute on function public.fn_sync_bestsellers() from public;

do $sched$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'logos_bestsellers';
    -- NYT refreshes lists ~Wednesday & Sunday; pull both mornings (13:00 UTC).
    perform cron.schedule('logos_bestsellers', '0 13 * * 3,0', 'select public.fn_sync_bestsellers();');
    raise notice 'logos_bestsellers cron scheduled (edit fn_sync_bestsellers placeholders to activate).';
  else
    raise notice 'pg_cron NOT enabled — function created but NOT scheduled. Enable pg_cron + pg_net, edit placeholders, then re-run.';
  end if;
end $sched$;
