-- ============================================================================
-- LOGOS — initial schema (B1)
-- Source of truth: LOGOS_BLUEPRINT.md §1. Safe to re-run (idempotent guards).
--
-- Deviations from the blueprint SQL (intentional):
--   • is_minor / is_under_13: blueprint used GENERATED ALWAYS AS (... now() ...)
--     STORED — Postgres rejects stored generated columns that use non-immutable
--     functions (now()). Implemented as plain columns maintained by a BEFORE
--     INSERT/UPDATE trigger instead (semantics preserved; a nightly recompute
--     can be added in B4's cron so 17→18 transitions flip).
--   • pg_cron extension is NOT created here — it is only needed for scheduled
--     jobs, which land in B4. Adding it now can fail on some setups.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- fuzzy library search

-- ── Enums (guarded so re-runs don't error) ──────────────────────────────────
do $$ begin create type book_format   as enum ('physical','ebook','audiobook'); exception when duplicate_object then null; end $$;
do $$ begin create type theme_pref     as enum ('dark','light','system'); exception when duplicate_object then null; end $$;
do $$ begin create type sub_status     as enum ('free','trialing','active','expired','grace'); exception when duplicate_object then null; end $$;
do $$ begin create type session_source as enum ('live','backdated','offline_sync'); exception when duplicate_object then null; end $$;
do $$ begin create type insight_type_enum as enum ('TIME_OF_DAY','PACE_TREND','GENRE_SPEED','CONSISTENCY','PAGE_MILESTONE','BEST_SESSION','BOOK_PACE'); exception when duplicate_object then null; end $$;
do $$ begin create type achievement_kind as enum ('streak','volume','consistency','speed','social','milestone'); exception when duplicate_object then null; end $$;
do $$ begin create type challenge_status as enum ('active','completed','failed','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type notif_type_enum as enum ('at_risk','streak_broken','comeback_challenge_created','comeback_challenge_progress','comeback_challenge_expired','comeback_restored','daily_reminder','weekly_digest','goal_milestone','almost_there','reading_insight','long_absence_3d'); exception when duplicate_object then null; end $$;
do $$ begin create type reading_status as enum ('want','reading','finished','dnf'); exception when duplicate_object then null; end $$;

-- ── USERS (1:1 with auth.users) ─────────────────────────────────────────────
create table if not exists public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  username                text unique,
  display_name            text,
  avatar_url              text,
  birth_year              smallint not null check (birth_year between 1900 and extract(year from now())::int),
  is_minor                boolean not null default false,   -- maintained by trg_set_age_flags
  is_under_13             boolean not null default false,   -- maintained by trg_set_age_flags
  theme                   theme_pref not null default 'dark',
  timezone_offset_minutes integer not null default 0,
  timezone_name           text     not null default 'UTC',
  expo_push_token         text,
  total_xp                bigint   not null default 0,
  level                   smallint not null default 1,
  level_name              text     not null default 'Page Turner',
  subscription_status     sub_status not null default 'free',
  rc_app_user_id          text,
  has_seen_swipe_hint     boolean  not null default false,
  tooltip_seen_map        jsonb    not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists users_push_token_idx on public.users (expo_push_token) where expo_push_token is not null;
create index if not exists users_level_idx      on public.users (level);

-- ── BOOKS (global catalog) ──────────────────────────────────────────────────
create table if not exists public.books (
  id              uuid primary key default gen_random_uuid(),
  google_books_id text unique,
  open_library_id text,
  isbn_13         text,
  isbn_10         text,
  title           text not null,
  subtitle        text,
  authors         text[] not null default '{}',
  cover_url       text,
  page_count      integer,
  duration_minutes integer,
  published_year  smallint,
  publisher       text,
  description     text,
  genres          text[] not null default '{}',
  language        text default 'en',
  created_at      timestamptz not null default now()
);
create index if not exists books_isbn13_idx on public.books (isbn_13);
create index if not exists books_google_idx on public.books (google_books_id);
create index if not exists books_title_trgm on public.books using gin (title gin_trgm_ops);
create index if not exists books_genres_gin on public.books using gin (genres);

-- ── USER_BOOKS ──────────────────────────────────────────────────────────────
create table if not exists public.user_books (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  book_id                uuid not null references public.books(id) on delete cascade,
  format                 book_format not null default 'physical',
  status                 reading_status not null default 'want',
  current_page           integer not null default 0,
  current_position_min   integer not null default 0,
  page_count_override    integer,
  total_duration_minutes integer,
  series_name            text,
  series_number          numeric(5,1),
  started_at             timestamptz,
  finished_at            timestamptz,
  is_favorite            boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, book_id, format)
);
create index if not exists user_books_user_idx   on public.user_books (user_id);
create index if not exists user_books_status_idx on public.user_books (user_id, status);
create index if not exists user_books_active_idx on public.user_books (user_id) where status = 'reading';

-- ── READING_SESSIONS (format-aware) ─────────────────────────────────────────
create table if not exists public.reading_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  user_book_id     uuid not null references public.user_books(id) on delete cascade,
  book_id          uuid not null references public.books(id) on delete cascade,
  format           book_format not null,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  start_page       integer,
  end_page         integer,
  pages_read       integer,
  minutes_listened integer,
  pph              numeric(7,2),
  source           session_source not null default 'live',
  client_uuid      uuid,
  local_date       date not null,
  xp_awarded       integer not null default 0,
  is_personal_best boolean not null default false,
  created_at       timestamptz not null default now(),
  check (
    (format in ('physical','ebook') and pages_read is not null and minutes_listened is null)
    or
    (format = 'audiobook' and pages_read is null and minutes_listened is not null)
  ),
  unique (user_id, client_uuid)
);
create index if not exists sessions_user_date_idx on public.reading_sessions (user_id, local_date desc);
create index if not exists sessions_userbook_idx  on public.reading_sessions (user_book_id);
create index if not exists sessions_started_idx   on public.reading_sessions (user_id, started_at desc);

-- ── REVIEWS ─────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  user_book_id      uuid references public.user_books(id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  body              text,
  contains_spoilers boolean not null default false,
  is_public         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists reviews_book_idx on public.reviews (book_id) where is_public;
create index if not exists reviews_user_idx on public.reviews (user_id);

-- ── ACHIEVEMENTS (catalog) ──────────────────────────────────────────────────
create table if not exists public.achievements (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,
  name                   text not null,
  description            text not null,
  kind                   achievement_kind not null,
  icon_name              text not null,
  lottie_key             text,
  unlock_metric          text not null,
  unlock_threshold       numeric not null,
  almost_there_threshold numeric not null default 0.80,
  xp_reward              integer not null default 0,
  sort_order             integer not null default 0,
  is_active              boolean not null default true
);

-- ── USER_ACHIEVEMENTS ───────────────────────────────────────────────────────
create table if not exists public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  progress_value numeric not null default 0,
  was_shared     boolean not null default false,
  unique (user_id, achievement_id)
);
create index if not exists user_ach_user_idx on public.user_achievements (user_id);

-- ── XP_LOG (immutable ledger) ───────────────────────────────────────────────
create table if not exists public.xp_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  xp_amount   integer not null,
  metadata    jsonb not null default '{}'::jsonb,
  session_id  uuid references public.reading_sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists xp_log_user_idx on public.xp_log (user_id, created_at desc);

-- ── READING_GOALS ───────────────────────────────────────────────────────────
create table if not exists public.reading_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  year       smallint not null,
  goal_books integer not null check (goal_books > 0),
  goal_pages integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

-- ── CHALLENGES + USER_CHALLENGES (Phase 2) ──────────────────────────────────
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text not null,
  metric       text not null,
  target_value numeric not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  xp_reward    integer not null default 0,
  is_global    boolean not null default true
);
create table if not exists public.user_challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  progress     numeric not null default 0,
  status       challenge_status not null default 'active',
  joined_at    timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, challenge_id)
);
create index if not exists user_challenges_user_idx on public.user_challenges (user_id, status);

-- ── STREAKS ─────────────────────────────────────────────────────────────────
create table if not exists public.streaks (
  user_id              uuid primary key references public.users(id) on delete cascade,
  current_streak       integer not null default 0,
  longest_streak       integer not null default 0,
  last_read_local_date date,
  grace_used_on        date,
  is_at_risk           boolean not null default false,
  freeze_tokens        integer not null default 0,
  updated_at           timestamptz not null default now()
);

-- ── STREAK_FREEZES (Phase 4) ────────────────────────────────────────────────
create table if not exists public.streak_freezes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  used_on    date not null,
  source     text not null default 'token',
  created_at timestamptz not null default now()
);

-- ── COMEBACK_CHALLENGES ─────────────────────────────────────────────────────
create table if not exists public.comeback_challenges (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  streak_at_break    integer not null,
  sessions_completed integer not null default 0,
  started_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  completed_at       timestamptz,
  expired_at         timestamptz,
  streak_restored    boolean not null default false,
  created_at         timestamptz not null default now()
);
create unique index if not exists one_active_comeback_per_user
  on public.comeback_challenges (user_id)
  where completed_at is null and expired_at is null;
create index if not exists comeback_user_idx on public.comeback_challenges (user_id, expires_at);

-- ── READING_INSIGHTS ────────────────────────────────────────────────────────
create table if not exists public.reading_insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  session_id    uuid references public.reading_sessions(id) on delete set null,
  insight_type  insight_type_enum not null,
  insight_text  text not null,
  data_snapshot jsonb not null default '{}'::jsonb,
  shown_at      timestamptz not null default now(),
  was_shared    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists insights_user_type_idx   on public.reading_insights (user_id, insight_type, shown_at desc);
create index if not exists insights_user_recent_idx on public.reading_insights (user_id, shown_at desc);

-- ── NOTIFICATION_SETTINGS ───────────────────────────────────────────────────
create table if not exists public.notification_settings (
  user_id             uuid primary key references public.users(id) on delete cascade,
  enabled             boolean not null default true,
  daily_reminder      boolean not null default true,
  daily_reminder_hour smallint not null default 20 check (daily_reminder_hour between 0 and 23),
  at_risk_alerts      boolean not null default true,
  weekly_digest       boolean not null default true,
  comeback_alerts     boolean not null default true,
  social_alerts       boolean not null default true,
  insight_alerts      boolean not null default true,
  quiet_hours_start   smallint default 22,
  quiet_hours_end     smallint default 8,
  updated_at          timestamptz not null default now()
);

-- ── SWIPE_HISTORY (Discover dedupe) ─────────────────────────────────────────
create table if not exists public.swipe_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  book_id         uuid references public.books(id) on delete set null,
  google_books_id text,
  direction       text not null check (direction in ('left','right','up')),
  created_at      timestamptz not null default now(),
  unique (user_id, google_books_id)
);
create index if not exists swipe_user_idx on public.swipe_history (user_id, created_at desc);

-- ── FOLLOWS (Phase 3) ───────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followee_id uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- ── AI_REC_CACHE ────────────────────────────────────────────────────────────
create table if not exists public.ai_rec_cache (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  prompt_hash   text not null,
  mood          text,
  response_json jsonb not null,
  model         text not null default 'claude-sonnet-4-20250514',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  unique (user_id, prompt_hash)
);
create index if not exists ai_rec_cache_lookup on public.ai_rec_cache (user_id, prompt_hash, expires_at);

-- ── LIVE_SESSION_STATE ──────────────────────────────────────────────────────
create table if not exists public.live_session_state (
  user_id          uuid primary key references public.users(id) on delete cascade,
  user_book_id     uuid references public.user_books(id) on delete cascade,
  book_title       text,
  cover_url        text,
  started_at       timestamptz,
  current_page     integer,
  goal_page        integer,
  live_activity_id text,
  is_active        boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ============================================================================
-- FUNCTIONS + TRIGGERS
-- ============================================================================

-- Generic updated_at touch.
create or replace function public.fn_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- Age flags (replaces the non-immutable STORED generated columns).
create or replace function public.fn_set_age_flags() returns trigger as $$
begin
  new.is_minor    := (extract(year from now())::int - new.birth_year) < 18;
  new.is_under_13 := (extract(year from now())::int - new.birth_year) < 13;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_age_flags on public.users;
create trigger trg_set_age_flags before insert or update of birth_year on public.users
  for each row execute function public.fn_set_age_flags();

-- Provision per-user singleton rows (streaks + notification settings).
create or replace function public.fn_provision_user() returns trigger as $$
begin
  insert into public.streaks (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.notification_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_provision_user on public.users;
create trigger trg_provision_user after insert on public.users
  for each row execute function public.fn_provision_user();

-- XP ledger → total_xp + level + level_name (denormalized; trigger-maintained only).
create or replace function public.fn_apply_xp() returns trigger as $$
declare
  v_total bigint;
  v_level smallint;
  v_name  text;
begin
  update public.users
     set total_xp = total_xp + new.xp_amount
   where id = new.user_id
   returning total_xp into v_total;

  select lvl, lname into v_level, v_name from (
    values
      (1,'Page Turner',0),(2,'Margin Scribbler',500),(3,'Chapter Chaser',1500),
      (4,'Shelf Builder',3500),(5,'Spine Cracker',7000),(6,'Night Reader',12000),
      (7,'Bibliophile',20000),(8,'Tome Raider',32000),(9,'Literary Athlete',50000),
      (10,'Logos Legend',80000)
  ) as t(lvl,lname,minxp)
  where v_total >= minxp
  order by minxp desc limit 1;

  update public.users
     set level = v_level, level_name = v_name, updated_at = now()
   where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_xp on public.xp_log;
create trigger trg_apply_xp after insert on public.xp_log
  for each row execute function public.fn_apply_xp();

-- Minors (13–17) cannot post public reviews.
create or replace function public.fn_lock_minor_reviews() returns trigger as $$
begin
  if exists (select 1 from public.users u where u.id = new.user_id and u.is_minor) then
    new.is_public := false;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_lock_minor_reviews on public.reviews;
create trigger trg_lock_minor_reviews before insert or update on public.reviews
  for each row execute function public.fn_lock_minor_reviews();

-- updated_at touches.
drop trigger if exists trg_touch_users on public.users;
create trigger trg_touch_users before update on public.users for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_user_books on public.user_books;
create trigger trg_touch_user_books before update on public.user_books for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_reviews on public.reviews;
create trigger trg_touch_reviews before update on public.reviews for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_goals on public.reading_goals;
create trigger trg_touch_goals before update on public.reading_goals for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_streaks on public.streaks;
create trigger trg_touch_streaks before update on public.streaks for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_notifset on public.notification_settings;
create trigger trg_touch_notifset before update on public.notification_settings for each row execute function public.fn_touch_updated_at();
drop trigger if exists trg_touch_live on public.live_session_state;
create trigger trg_touch_live before update on public.live_session_state for each row execute function public.fn_touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users                 enable row level security;
alter table public.books                 enable row level security;
alter table public.user_books            enable row level security;
alter table public.reading_sessions      enable row level security;
alter table public.reviews               enable row level security;
alter table public.achievements          enable row level security;
alter table public.user_achievements     enable row level security;
alter table public.xp_log                enable row level security;
alter table public.reading_goals         enable row level security;
alter table public.challenges            enable row level security;
alter table public.user_challenges       enable row level security;
alter table public.streaks               enable row level security;
alter table public.streak_freezes        enable row level security;
alter table public.comeback_challenges   enable row level security;
alter table public.reading_insights      enable row level security;
alter table public.notification_settings enable row level security;
alter table public.swipe_history         enable row level security;
alter table public.follows               enable row level security;
alter table public.ai_rec_cache          enable row level security;
alter table public.live_session_state    enable row level security;

-- Owner-only tables.
drop policy if exists own_users on public.users;
create policy own_users on public.users for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists own_userbooks on public.user_books;
create policy own_userbooks on public.user_books for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_sessions on public.reading_sessions;
create policy own_sessions on public.reading_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_userach on public.user_achievements;
create policy own_userach on public.user_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_xp on public.xp_log;
create policy own_xp on public.xp_log for select using (auth.uid() = user_id);
drop policy if exists own_goals on public.reading_goals;
create policy own_goals on public.reading_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_uchal on public.user_challenges;
create policy own_uchal on public.user_challenges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_streaks on public.streaks;
create policy own_streaks on public.streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_freezes on public.streak_freezes;
create policy own_freezes on public.streak_freezes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_comeback on public.comeback_challenges;
create policy own_comeback on public.comeback_challenges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_insights on public.reading_insights;
create policy own_insights on public.reading_insights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_notifset on public.notification_settings;
create policy own_notifset on public.notification_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_swipes on public.swipe_history;
create policy own_swipes on public.swipe_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_airec on public.ai_rec_cache;
create policy own_airec on public.ai_rec_cache for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_live on public.live_session_state;
create policy own_live on public.live_session_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Catalog tables: world-readable; writes only via service role (edge fns).
drop policy if exists read_books on public.books;
create policy read_books on public.books for select using (true);
drop policy if exists read_ach on public.achievements;
create policy read_ach on public.achievements for select using (true);
drop policy if exists read_chal on public.challenges;
create policy read_chal on public.challenges for select using (true);

-- Reviews: owner full access; everyone reads PUBLIC reviews.
drop policy if exists own_reviews on public.reviews;
create policy own_reviews on public.reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists public_reviews on public.reviews;
create policy public_reviews on public.reviews for select using (is_public = true);

-- Follows (Phase 3).
drop policy if exists own_follows_w on public.follows;
create policy own_follows_w on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
drop policy if exists read_follows on public.follows;
create policy read_follows on public.follows for select using (true);

-- Safe public profile projection (adults only).
create or replace view public.public_profiles as
  select id, username, display_name, avatar_url, level, level_name
  from public.users
  where is_minor = false;
