# LOGOS — Master Technical & Product Blueprint

> "In the beginning was the Word. Track every one you read."
> Emotional north star: *Using Logos makes me feel like a serious reader — a literary athlete.*

**Single source of truth.** Stack: React Native + Expo (managed) · Supabase (Postgres/Auth/Storage/Realtime/Edge Functions/pg_cron) · Zustand + MMKV · Reanimated 3 · Expo Router · PostHog (self-hosted) · Claude API (`claude-sonnet-4-20250514`) · RevenueCat (Phase 4).

**Design authority:** The vibrant dark palette and gamification directives in the brief override any generic recommendation. Identity surfaces (level-name reveals, Year-in-Books) use a literary display face (Cormorant Garamond / Cinzel) over the UI sans to reinforce the "scholar-athlete" feel; all functional UI uses the system sans (SF Pro / Roboto via platform default + Inter for cross-platform numerics with tabular figures).

**`[VERIFY]`** marks claims to confirm against live SDK/API docs before relying on them.

---

# SECTION 1 — DATABASE SCHEMA

**Depends on this:** every other section. The `format` enum, `pages_read` nullability, `level_name` storage strategy, and `streaks` shape are load-bearing — changing them mid-build forces migrations across edge functions, the offline queue type, and every card/notification template.

**Highest-risk decisions:** (1) `level_name` — *stored* (denormalized) vs *computed*. We store it on `users` (updated by trigger on `xp_log` insert) because push notifications and share cards must read it without recomputing XP→level on a hot path. Dependency: every XP award must keep it fresh (Section 5 `xp_award`). (2) Streak time math stored in UTC with a per-user `timezone_offset_minutes` so server cron can evaluate "did they read on their local day." (3) `reading_sessions.pages_read` is NULLABLE specifically for audiobooks — all PPH math must guard NULL.

**Most common mistake:** forgetting `ON DELETE CASCADE` on a child FK, leaving orphan rows that break the account-deletion guarantee (Section 21). Every FK to `users(id)` below cascades.

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";     -- scheduled jobs
create extension if not exists "pg_trgm";     -- fuzzy library search

-- ============================================================
-- ENUMS
-- ============================================================
create type book_format       as enum ('physical','ebook','audiobook');
create type theme_pref         as enum ('dark','light','system');
create type sub_status         as enum ('free','trialing','active','expired','grace');
create type session_source     as enum ('live','backdated','offline_sync');
create type insight_type_enum  as enum (
  'TIME_OF_DAY','PACE_TREND','GENRE_SPEED','CONSISTENCY',
  'PAGE_MILESTONE','BEST_SESSION','BOOK_PACE'
);
create type achievement_kind   as enum ('streak','volume','consistency','speed','social','milestone');
create type challenge_status    as enum ('active','completed','failed','expired');
create type notif_type_enum     as enum (
  'at_risk','streak_broken','comeback_challenge_created','comeback_challenge_progress',
  'comeback_challenge_expired','comeback_restored','daily_reminder','weekly_digest',
  'goal_milestone','almost_there','reading_insight','long_absence_3d'
);
create type reading_status      as enum ('want','reading','finished','dnf');

-- ============================================================
-- USERS  (1:1 with auth.users)
-- ============================================================
create table public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  username                text unique,
  display_name            text,
  avatar_url              text,
  birth_year              smallint not null check (birth_year between 1900 and extract(year from now())::int),
  is_minor                boolean generated always as
                            ((extract(year from now())::int - birth_year) < 18) stored,
  is_under_13             boolean generated always as
                            ((extract(year from now())::int - birth_year) < 13) stored,
  theme                   theme_pref not null default 'dark',
  timezone_offset_minutes integer not null default 0,    -- e.g. -480 for PST
  timezone_name           text     not null default 'UTC', -- IANA, e.g. 'America/Los_Angeles'
  expo_push_token         text,
  total_xp                bigint   not null default 0,
  level                   smallint not null default 1,
  level_name              text     not null default 'Page Turner', -- denormalized, trigger-maintained
  subscription_status     sub_status not null default 'free',
  rc_app_user_id          text,    -- RevenueCat app user id (Phase 4)
  has_seen_swipe_hint     boolean  not null default false,
  tooltip_seen_map        jsonb    not null default '{}'::jsonb, -- {"fab":true,"scanner":false,...}
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index users_push_token_idx on public.users (expo_push_token) where expo_push_token is not null;
create index users_level_idx      on public.users (level);

-- ============================================================
-- BOOKS  (global catalog, deduped by external id)
-- ============================================================
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  google_books_id text unique,
  open_library_id text,
  isbn_13         text,
  isbn_10         text,
  title           text not null,
  subtitle        text,
  authors         text[] not null default '{}',
  cover_url       text,
  page_count      integer,                 -- canonical page count (physical/ebook)
  duration_minutes integer,                -- canonical audiobook runtime (if known)
  published_year  smallint,
  publisher       text,
  description     text,
  genres          text[] not null default '{}',
  language        text default 'en',
  created_at      timestamptz not null default now()
);
create index books_isbn13_idx   on public.books (isbn_13);
create index books_google_idx   on public.books (google_books_id);
create index books_title_trgm   on public.books using gin (title gin_trgm_ops);
create index books_genres_gin   on public.books using gin (genres);

-- ============================================================
-- USER_BOOKS  (a user's shelf entry for a book)
-- ============================================================
create table public.user_books (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  book_id                uuid not null references public.books(id) on delete cascade,
  format                 book_format not null default 'physical',
  status                 reading_status not null default 'want',
  current_page           integer not null default 0,
  current_position_min   integer not null default 0,   -- audiobook progress in minutes
  page_count_override     integer,                       -- user-corrected page count
  total_duration_minutes integer,                        -- audiobook runtime override (NULLABLE)
  series_name            text,
  series_number          numeric(5,1),
  started_at             timestamptz,
  finished_at            timestamptz,
  is_favorite            boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, book_id, format)
);
create index user_books_user_idx        on public.user_books (user_id);
create index user_books_status_idx      on public.user_books (user_id, status);
create index user_books_active_idx      on public.user_books (user_id) where status = 'reading';

-- ============================================================
-- READING_SESSIONS  (format-aware; pages NULL for audiobook)
-- ============================================================
create table public.reading_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  user_book_id       uuid not null references public.user_books(id) on delete cascade,
  book_id            uuid not null references public.books(id) on delete cascade,
  format             book_format not null,
  started_at         timestamptz not null,
  ended_at           timestamptz not null,
  duration_seconds   integer not null check (duration_seconds >= 0),
  start_page         integer,                 -- NULL for audiobook
  end_page           integer,                 -- NULL for audiobook
  pages_read         integer,                 -- NULL for audiobook; else end-start
  minutes_listened   integer,                 -- audiobook only; NULL otherwise
  pph                numeric(7,2),            -- pages per hour; NULL for audiobook
  source             session_source not null default 'live',
  client_uuid        uuid,                    -- idempotency key from MMKV offline queue
  local_date         date not null,           -- the user's LOCAL calendar day (for streaks)
  xp_awarded         integer not null default 0,
  is_personal_best   boolean not null default false,
  created_at         timestamptz not null default now(),
  check (
    (format in ('physical','ebook') and pages_read is not null and minutes_listened is null)
    or
    (format = 'audiobook' and pages_read is null and minutes_listened is not null)
  ),
  unique (user_id, client_uuid)               -- dedupe offline re-sync
);
create index sessions_user_date_idx  on public.reading_sessions (user_id, local_date desc);
create index sessions_userbook_idx   on public.reading_sessions (user_book_id);
create index sessions_started_idx    on public.reading_sessions (user_id, started_at desc);

-- ============================================================
-- REVIEWS
-- ============================================================
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  book_id       uuid not null references public.books(id) on delete cascade,
  user_book_id  uuid references public.user_books(id) on delete set null,
  rating        smallint not null check (rating between 1 and 5),
  body          text,
  contains_spoilers boolean not null default false,
  is_public     boolean not null default true,  -- forced false for 13-17 (RLS+trigger)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, book_id)
);
create index reviews_book_idx on public.reviews (book_id) where is_public;
create index reviews_user_idx on public.reviews (user_id);

-- ============================================================
-- ACHIEVEMENTS  (badge catalog)  + almost_there_threshold
-- ============================================================
create table public.achievements (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,            -- 'week_warrior'
  name                   text not null,                   -- 'Week Warrior'
  description            text not null,
  kind                   achievement_kind not null,
  icon_name              text not null,
  lottie_key             text,
  unlock_metric          text not null,                   -- 'streak_days' | 'total_pages' | ...
  unlock_threshold       numeric not null,                -- e.g. 7
  almost_there_threshold numeric not null default 0.80,   -- show "almost there" at >= 80% of unlock
  xp_reward              integer not null default 0,
  sort_order             integer not null default 0,
  is_active              boolean not null default true
);

-- ============================================================
-- USER_ACHIEVEMENTS
-- ============================================================
create table public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  achievement_id  uuid not null references public.achievements(id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  progress_value  numeric not null default 0,   -- snapshot of metric at unlock
  was_shared      boolean not null default false,
  unique (user_id, achievement_id)
);
create index user_ach_user_idx on public.user_achievements (user_id);

-- ============================================================
-- XP_LOG  (immutable ledger; drives total_xp + level_name)
-- ============================================================
create table public.xp_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  action_type  text not null,            -- 'session_complete','streak_day','badge', etc.
  xp_amount    integer not null,
  metadata     jsonb not null default '{}'::jsonb,
  session_id   uuid references public.reading_sessions(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index xp_log_user_idx on public.xp_log (user_id, created_at desc);

-- ============================================================
-- READING_GOALS
-- ============================================================
create table public.reading_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  year          smallint not null,
  goal_books    integer not null check (goal_books > 0),
  goal_pages    integer,                 -- optional secondary goal
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, year)
);

-- ============================================================
-- CHALLENGES + USER_CHALLENGES  (Phase 2 time-boxed events)
-- ============================================================
create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text not null,
  metric        text not null,           -- 'pages' | 'sessions' | 'minutes' | 'books'
  target_value  numeric not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  xp_reward     integer not null default 0,
  is_global     boolean not null default true
);
create table public.user_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  progress      numeric not null default 0,
  status        challenge_status not null default 'active',
  joined_at     timestamptz not null default now(),
  completed_at  timestamptz,
  unique (user_id, challenge_id)
);
create index user_challenges_user_idx on public.user_challenges (user_id, status);

-- ============================================================
-- STREAKS  (one row per user)
-- ============================================================
create table public.streaks (
  user_id            uuid primary key references public.users(id) on delete cascade,
  current_streak     integer not null default 0,
  longest_streak     integer not null default 0,
  last_read_local_date date,             -- last LOCAL day with a qualifying session
  grace_used_on      date,               -- the local date a 24h grace buffer was consumed
  is_at_risk         boolean not null default false,  -- set after 18:00 local with no session
  freeze_tokens      integer not null default 0,      -- Phase 4
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- STREAK_FREEZES  (Phase 4 ledger)
-- ============================================================
create table public.streak_freezes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  used_on     date not null,
  source      text not null default 'token',  -- 'token' | 'purchase' | 'gift'
  created_at  timestamptz not null default now()
);

-- ============================================================
-- COMEBACK_CHALLENGES  (Phase 1)
-- ============================================================
create table public.comeback_challenges (
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
-- enforce AT MOST ONE active comeback per user
create unique index one_active_comeback_per_user
  on public.comeback_challenges (user_id)
  where completed_at is null and expired_at is null;
create index comeback_user_idx on public.comeback_challenges (user_id, expires_at);

-- ============================================================
-- READING_INSIGHTS  (variable reward history)
-- ============================================================
create table public.reading_insights (
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
create index insights_user_type_idx on public.reading_insights (user_id, insight_type, shown_at desc);
create index insights_user_recent_idx on public.reading_insights (user_id, shown_at desc);

-- ============================================================
-- NOTIFICATION_SETTINGS
-- ============================================================
create table public.notification_settings (
  user_id              uuid primary key references public.users(id) on delete cascade,
  enabled              boolean not null default true,
  daily_reminder       boolean not null default true,
  daily_reminder_hour  smallint not null default 20 check (daily_reminder_hour between 0 and 23),
  at_risk_alerts       boolean not null default true,
  weekly_digest        boolean not null default true,
  comeback_alerts      boolean not null default true,
  social_alerts        boolean not null default true,
  insight_alerts       boolean not null default true,
  quiet_hours_start    smallint default 22,
  quiet_hours_end      smallint default 8,
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- SWIPE_HISTORY  (Discover dedupe)
-- ============================================================
create table public.swipe_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  book_id     uuid references public.books(id) on delete set null,
  google_books_id text,                 -- store even if not in books table yet
  direction   text not null check (direction in ('left','right','up')), -- pass/save/superlike
  created_at  timestamptz not null default now(),
  unique (user_id, google_books_id)
);
create index swipe_user_idx on public.swipe_history (user_id, created_at desc);

-- ============================================================
-- FOLLOWS  (Phase 3 social)
-- ============================================================
create table public.follows (
  follower_id  uuid not null references public.users(id) on delete cascade,
  followee_id  uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

-- ============================================================
-- AI_REC_CACHE  (Claude rec caching)
-- ============================================================
create table public.ai_rec_cache (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  prompt_hash   text not null,           -- hash of (mood + recent books + genres)
  mood          text,
  response_json jsonb not null,
  model         text not null default 'claude-sonnet-4-20250514',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  unique (user_id, prompt_hash)
);
create index ai_rec_cache_lookup on public.ai_rec_cache (user_id, prompt_hash, expires_at);

-- ============================================================
-- LIVE_SESSION_STATE  (drives Live Activity / Dynamic Island)
-- ============================================================
create table public.live_session_state (
  user_id          uuid primary key references public.users(id) on delete cascade,
  user_book_id     uuid references public.user_books(id) on delete cascade,
  book_title       text,
  cover_url        text,
  started_at       timestamptz,
  current_page     integer,
  goal_page        integer,
  live_activity_id text,                 -- ActivityKit token (iOS)
  is_active        boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS:  level_name + total_xp maintenance, updated_at, minor review lock
-- ============================================================
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

  -- level_from_xp: see Section 5 thresholds (kept in sync with LEVELS const)
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

create trigger trg_apply_xp after insert on public.xp_log
  for each row execute function public.fn_apply_xp();

create or replace function public.fn_lock_minor_reviews() returns trigger as $$
begin
  if exists (select 1 from public.users u where u.id = new.user_id and u.is_minor) then
    new.is_public := false;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_lock_minor_reviews before insert or update on public.reviews
  for each row execute function public.fn_lock_minor_reviews();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users               enable row level security;
alter table public.books               enable row level security;
alter table public.user_books          enable row level security;
alter table public.reading_sessions    enable row level security;
alter table public.reviews             enable row level security;
alter table public.achievements        enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.xp_log              enable row level security;
alter table public.reading_goals       enable row level security;
alter table public.challenges          enable row level security;
alter table public.user_challenges     enable row level security;
alter table public.streaks             enable row level security;
alter table public.streak_freezes      enable row level security;
alter table public.comeback_challenges enable row level security;
alter table public.reading_insights    enable row level security;
alter table public.notification_settings enable row level security;
alter table public.swipe_history       enable row level security;
alter table public.follows             enable row level security;
alter table public.ai_rec_cache        enable row level security;
alter table public.live_session_state  enable row level security;

-- Owner-only tables (the common pattern)
create policy own_users      on public.users               for all using (auth.uid() = id) with check (auth.uid() = id);
create policy own_userbooks  on public.user_books          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_sessions   on public.reading_sessions    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_userach    on public.user_achievements   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_xp         on public.xp_log              for select using (auth.uid() = user_id);
create policy own_goals      on public.reading_goals       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_uchal      on public.user_challenges     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_streaks    on public.streaks             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_freezes    on public.streak_freezes      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_comeback   on public.comeback_challenges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_insights   on public.reading_insights    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_notifset   on public.notification_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_swipes     on public.swipe_history       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_airec      on public.ai_rec_cache        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_live       on public.live_session_state  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Catalog tables: world-readable, writes via service role only
create policy read_books     on public.books        for select using (true);
create policy read_ach       on public.achievements for select using (true);
create policy read_chal      on public.challenges   for select using (true);

-- Reviews: owner full access; others read only PUBLIC reviews
create policy own_reviews    on public.reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy public_reviews on public.reviews for select
  using (is_public = true);

-- Follows + public profiles (Phase 3): adults only, enforced in edge fn + policy
create policy own_follows_w  on public.follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy read_follows   on public.follows for select using (true);

-- Public user fields read (Phase 3): a separate VIEW exposes only safe columns
create or replace view public.public_profiles as
  select id, username, display_name, avatar_url, level, level_name
  from public.users
  where is_minor = false;
```

> **Schema dependency flags:** (a) `users.level_name` denormalization → keep in sync via `xp_log` trigger only; never write it directly. (b) `reading_sessions.local_date` is computed client-side from `timezone_offset_minutes` and is the streak source of truth — do not derive streaks from `started_at` UTC. (c) `one_active_comeback_per_user` partial unique index enforces the "at most one active comeback" rule at the DB layer; the edge function must `ON CONFLICT DO NOTHING`.

# SECTION 2 — API ARCHITECTURE

**Depends on this:** every screen's data layer and all gamification side-effects. The decisive rule below resolves the most common architectural mistake.

**Highest-risk decision:** *Where does session-completion logic live?* A naive build does streak/XP/badge/insight/comeback mutations on the client after `insert session`. That is wrong — it is non-atomic (offline re-sync double-counts), it is cheatable, and `level_name` can drift. **Decision: one transactional edge function `complete_session` owns ALL post-session side effects.** The client only inserts the raw session into the MMKV queue and calls `complete_session` (immediately when online, on sync when offline). This is the single most important architectural rule in Logos.

**Most common mistake:** computing the 30% insight gate or streak increment client-side, producing inconsistent results across the offline path and the online path. Gate everything in the edge function with the session's `client_uuid` as the idempotency key.

### 2.1 Client query vs Edge function map

| Feature | Mechanism | Why |
|---|---|---|
| Library list / shelf | Direct Supabase query (RLS) | Read-only, owner-scoped |
| Book search (Google Books) | Client → Google Books API directly | No secret needed; fallback to Open Library |
| Add book to shelf | Direct insert `user_books` (+ upsert `books` via edge fn `ensure_book`) | `books` writes need service role |
| Start session | Client writes `live_session_state` + starts Live Activity | Low latency, owner-scoped |
| **Complete session** | **Edge fn `complete_session`** (atomic) | Streak/XP/badge/insight/comeback/PB — must be transactional + idempotent |
| Backdate session | Same `complete_session` with `source='backdated'` | Recomputes streak over historical `local_date` |
| Offline session sync | Client drains MMKV → `complete_session` per item | `client_uuid` dedupe |
| Streak recompute (cron) | pg_cron → `fn_evaluate_streaks()` | Server clock authority |
| At-risk flag (18:00 local) | pg_cron hourly → per-timezone bucket | Needs server time + tz offset |
| Comeback create | Inside `fn_evaluate_streaks` on break | Trigger on break only |
| Comeback progress | Inside `complete_session` | Each session may increment |
| Variable reward insight | Inside `complete_session` (server) | 30% gate must be authoritative |
| Push send | Edge fn `send_push` called by cron jobs | Expo push API + token mgmt |
| Claude AI recs | Edge fn `ai_recommend` | API key is a secret; caching |
| Account deletion | Edge fn `delete_account` | Cascade + RevenueCat + auth delete |
| Data export | Edge fn `export_data` → Storage signed URL + email | Heavy aggregation, async |
| PostHog events | Client SDK direct | Self-hosted ingestion endpoint |

### 2.2 `complete_session` edge function (authoritative pseudocode)

```pseudocode
function complete_session(req):
  user_id = auth.uid()
  s = req.session   # {client_uuid, user_book_id, format, started_at, ended_at,
                    #  start_page, end_page, minutes_listened, source, local_date}

  BEGIN TRANSACTION
    # 1. Idempotent insert (offline re-sync safe)
    existing = SELECT id FROM reading_sessions
               WHERE user_id=user_id AND client_uuid=s.client_uuid
    if existing: ROLLBACK; return { ok:true, deduped:true, session_id: existing.id }

    duration_seconds = epoch(s.ended_at) - epoch(s.started_at)
    if s.format in ('physical','ebook'):
        pages_read = s.end_page - s.start_page
        pph        = duration_seconds>0 ? pages_read / (duration_seconds/3600.0) : null
        minutes_listened = null
    else: # audiobook
        pages_read = null; pph = null
        minutes_listened = s.minutes_listened

    session = INSERT INTO reading_sessions(...) RETURNING *

    # 2. Update book progress
    UPDATE user_books SET
        current_page = GREATEST(current_page, s.end_page),         # physical/ebook
        current_position_min = GREATEST(current_position_min, s.end_position),  # audiobook
        status = 'reading', updated_at = now()
      WHERE id = s.user_book_id

    # 3. Personal best?
    is_pb = (pages_read is not null) AND
            pages_read >= (SELECT COALESCE(MAX(pages_read),0)
                           FROM reading_sessions WHERE user_id=user_id AND id<>session.id)
    UPDATE reading_sessions SET is_personal_best = is_pb WHERE id = session.id

    # 4. Streak (see Section 5 streak_calculation, called inline w/ local_date)
    streak_result = apply_streak(user_id, s.local_date)   # returns {current, incremented, restored_via_grace}

    # 5. XP awards (Section 5 xp_award) — inserts into xp_log → trigger refreshes level_name
    xp_total = 0
    xp_total += xp_award(user_id,'session_complete',{session_id, pages_read, minutes_listened})
    if streak_result.incremented:
        xp_total += xp_award(user_id,'streak_day',{streak: streak_result.current})
    if is_pb: xp_total += xp_award(user_id,'personal_best',{})

    # 6. Badge evaluation (Section 5 badge_evaluator)
    new_badges = badge_evaluator(user_id, trigger='session_complete')
    for b in new_badges: xp_total += xp_award(user_id,'badge',{slug:b.slug})

    # 7. Comeback progress (Section 5/7)
    comeback = comeback_challenge_progress(user_id, session.id)  # may restore streak

    # 8. Variable reward (Section 5/6) — 30% gate, server-seeded
    insight = variable_reward_trigger(user_id, session.id)       # nullable

    UPDATE reading_sessions SET xp_awarded = xp_total WHERE id = session.id
  COMMIT

  return {
    ok:true, session_id: session.id, pages_read, pph, duration_seconds,
    is_personal_best: is_pb,
    streak: streak_result, xp_gained: xp_total,
    new_badges, comeback, insight,
    milestone_variant: milestone_celebration_type(streak_result.current)
  }
```

### 2.3 pg_cron jobs

| Job | Schedule (UTC) | Function | Purpose |
|---|---|---|---|
| `streak_eval` | `0 * * * *` (hourly) | `fn_evaluate_streaks()` | For users whose local time just crossed midnight: if no qualifying session yesterday and no grace/freeze → break streak, create comeback |
| `at_risk_flag` | `0 * * * *` (hourly) | `fn_flag_at_risk()` | For users where local time just passed 18:00 with no session today → set `is_at_risk=true`, queue `at_risk` push |
| `daily_reminder` | `0 * * * *` (hourly) | `fn_daily_reminders()` | Users whose local `daily_reminder_hour` == current local hour → queue `daily_reminder` |
| `weekly_digest` | `0 * * * *` (hourly) | `fn_weekly_digest()` | Sunday 18:00 local per user → aggregate week, queue `weekly_digest` |
| `comeback_expiry` | `*/15 * * * *` | `fn_expire_comebacks()` | Mark `expired_at` where `now() > expires_at` and not completed; queue `comeback_challenge_expired` |
| `long_absence` | `0 * * * *` | `fn_long_absence()` | No session in 3 local days → queue `long_absence_3d` |
| `ai_cache_gc` | `0 3 * * *` | delete from ai_rec_cache where expires_at<now() | GC |

> **Timezone handling rule:** all cron jobs run hourly in UTC and *bucket users by `timezone_offset_minutes`*. "Has the user's local midnight / 18:00 / reminder-hour just elapsed in this UTC hour?" is computed as `((extract(hour from now() at time zone 'utc')*60 + timezone_offset_minutes) mod 1440)`. This avoids a per-user scheduler. `[VERIFY]` pg_cron minimum granularity is 1 minute on Supabase.

### 2.4 Other edge functions (signatures)

```pseudocode
ensure_book(google_books_id|isbn) -> books.id            # upsert into catalog
ai_recommend(mood, context) -> { recs[], cached:bool }   # Section 17
send_push(user_ids[], notif_type, template_vars) -> {sent,failed}
delete_account() -> { ok }                                # Section 21
export_data() -> { queued:true }  # async → Storage signed URL emailed within 24h
```

> **PostHog firing:** client-side via `posthog-react-native`. Server-authoritative events that the client cannot observe (e.g. `comeback_challenge_expired` fired by cron) are sent from the edge function via PostHog's HTTP capture API using the user's `distinct_id = user_id`. See Section 18.

---

# SECTION 3 — REACT NATIVE SCREEN MAP (Expo Router)

**Depends on this:** navigation, deep links (Section 19), Live Activity tap targets, analytics screen events.

**Highest-risk decision:** the **session tracker is a full-screen `Stack` route, not a modal**, so the Live Activity / Dynamic Island can deep-link straight into it from a locked phone and so the OS keeps it foreground-stable. Celebrations are `transparentModal` overlays *on top of* the tracker so the cover-slide animation composites over the live screen.

**Most common mistake:** putting the session timer inside the tab navigator — the bottom tab bar then steals the bottom 25% thumb zone reserved for session controls, and back-swipe can accidentally abort an active session. Keep it in the root stack above tabs.

```
app/
├── _layout.tsx                         Root Stack + providers (Auth, Zustand, Theme, PostHog)
├── index.tsx                           Boot redirect → onboarding | (tabs)/home
│
├── (auth)/                             Stack — unauthenticated
│   ├── _layout.tsx
│   ├── sign-in.tsx                     deep: logos://sign-in   reads: —
│   └── sign-up.tsx
│
├── (onboarding)/                       Stack — g= one-question-per-screen, progress dots
│   ├── _layout.tsx                     params: { step }
│   ├── age-gate.tsx                    writes: users.birth_year   (Under-13 → blocked screen)
│   ├── welcome.tsx                     RULE 1 animated mock stat card (Lottie)
│   ├── genres.tsx                      writes: users (genre prefs)  RULE 2 mirror-back
│   ├── goal.tsx                        useReadingProjection (Sec 13)  writes: reading_goals
│   └── profile.tsx                     theme toggle; writes: users; → home
│
├── (tabs)/                             Tabs (max 5, labeled) — bottom nav
│   ├── _layout.tsx
│   ├── home/
│   │   ├── index.tsx                   HOME (bento)  reads: streaks, user_books, comeback_challenges, achievements, reading_goals
│   │   │                               hosts: ComebackChallenge widget, AlmostThereBanner, AtRiskBanner
│   │   │                               deep: logos://home
│   │   └── insights.tsx                Reading Insights history  reads: reading_insights  deep: logos://insights
│   ├── library/
│   │   ├── index.tsx                   LIBRARY (bottom search)  reads: user_books, books   deep: logos://library
│   │   ├── [userBookId].tsx            Book detail  reads: user_books, books, reviews, reading_sessions
│   │   └── tbr.tsx                     TBR list (Phase 2)  reads: user_books status='want'
│   ├── discover/
│   │   └── index.tsx                   SWIPE discovery (Phase 2)  reads: swipe_history; Google Books  deep: logos://discover
│   ├── stats/
│   │   └── index.tsx                   STATS bento + heatmap  reads: reading_sessions, xp_log, user_achievements  deep: logos://stats
│   └── profile/
│       ├── index.tsx                   PROFILE  reads: users, user_achievements, reading_goals
│       └── settings.tsx                Settings  reads/writes: notification_settings, users(theme)
│
├── session/                            ROOT STACK (above tabs) — full screen
│   ├── [userBookId].tsx                SESSION TRACKER (invisible UI, focus mode)  reads/writes: live_session_state, reading_sessions
│   │                                   deep: logos://session/[userBookId]  (Live Activity tap target)
│   └── backdate.tsx                    Backdate session sheet (date/time/page pickers)
│
├── (modals)/                           transparentModal presentations
│   ├── session-complete.tsx            SESSION-END CELEBRATION (Duolingo moment, Sec 5 timeline)
│   ├── milestone/[variant].tsx         MilestoneCelebration  variant ∈ normal|bigger|cinematic|legendary
│   ├── reading-insight.tsx             ReadingInsightCard overlay (slide-up, 200pt, 6s auto-dismiss)
│   ├── comeback.tsx                    ComebackChallengeScreen full modal  deep: logos://comeback
│   ├── share-card.tsx                  Shareable card composer (Transparent/Dark toggle)  reads: reading_sessions, users.level_name
│   ├── add-book.tsx                    Add-to-shelf sheet (format picker)
│   ├── scanner.tsx                     ISBN scanner (camera perm at first open)  deep: logos://scan
│   ├── review.tsx                      Write/edit review  writes: reviews
│   ├── filter-sort.tsx                 Library filter/sort bottom sheet
│   ├── goal-edit.tsx                   Edit reading goal  writes: reading_goals
│   └── paywall.tsx                     RevenueCat paywall (Phase 4, after aha)  deep: logos://upgrade
│
├── ai/
│   └── index.tsx                       Conversational AI recs (Phase 3, chat bubbles)  reads: ai_rec_cache  deep: logos://ai
│
└── +not-found.tsx
```

**Bottom-sheet inventory:** filter-sort, add-book, goal-edit, review (backdate, share-card later). All use the shared `SheetScaffold` with a **darkened rgba scrim backdrop (no BlurView/glass)** — see "Backdrop policy" below. **Banners (in-screen, not routes):** AtRiskBanner, AlmostThereBanner, ComebackChallenge widget — all live on `home/index.tsx` above the bento grid.

**Backdrop policy (implementation decision, 2026-06-04):** the app does **not** use frosted-glass / `BlurView` backdrops anywhere. Every modal, sheet, and celebration overlay dims the screen behind it with a **darkened translucent rgba scrim** (≈ `rgba(3,4,6,0.62)` dark / `rgba(17,19,24,0.4)` light). Rationale: consistent on iOS + Android, cheaper on Android, and the look the product wants. `expo-blur` is intentionally **not** a dependency. Any `BlurView intensity …` mentions elsewhere in this doc are superseded by this policy.

**Deep link routes (full list → Section 19):** `logos://home · /library · /session/:id · /comeback · /insights · /discover · /stats · /ai · /scan · /upgrade · /book/:id · /share/:cardId`.

# SECTION 4 — COMPONENT ARCHITECTURE

**Depends on this:** every screen. Shared props (`level_name`, theme tokens, reduced-motion) thread through everything.

**Highest-risk decision:** all animation uses **Reanimated 3 shared values on the UI thread** (`useSharedValue`, `withSpring`, `withTiming`, `useAnimatedStyle`) — never the legacy `Animated` API. The session timer must tick on the UI thread (a `useFrameCallback` derived value) so it never stutters when the JS thread is busy with sync/network.

**Most common mistake:** driving the timer or PPH counter with `setState`/`setInterval` — causes dropped frames and re-renders the whole tracker every second. Use a shared clock value + `useDerivedValue`.

### 4.1 Existing 29 components (TypeScript prop interfaces)

```typescript
// Theme + identity primitives shared by all
type LevelName = string;            // e.g. "Bibliophile"
interface ThemeTokens { bg:string; bgSec:string; bgTer:string; accent:string;
  text:string; textSec:string; border:string; mode:'dark'|'light'; }

// 1. AppShell — root providers + safe-area + status bar
interface AppShellProps { children: React.ReactNode; }

// 2. BentoGrid — variable-height tile layout (Home/Stats)
interface BentoGridProps { tiles: BentoTile[]; columns?: 2; gap?: number; }
interface BentoTile { id:string; span:1|2; height:number; render:()=>JSX.Element; }

// 3. StreakFlame — BIGGEST element on Home; loss-aversion
interface StreakFlameProps { count:number; isAtRisk:boolean; size?:number; }
// state: Reanimated pulse (withRepeat), color emerald→amber when atRisk

// 4. SessionTimer — UI-thread clock, invisible-UI focus mode
interface SessionTimerProps { startedAt:number; revealDetails:boolean;
  pph?:number|null; bookTitle?:string; format:BookFormat; }
// Reanimated: elapsed = useDerivedValue(frameClock); details opacity auto-hide 4s

// 5. SessionControlBar — glass bar, bottom 25%, stop after 2min
interface SessionControlBarProps { onPause:()=>void; onStop:()=>void;
  canStop:boolean; blurIntensity?:75; }

// 6. PphCounter — real-time pages/hr, tabular figures
interface PphCounterProps { pagesRead:number; elapsedSeconds:number; }

// 7. BookCover — expo-image, fallback placeholder
interface BookCoverProps { url?:string; title:string; format:BookFormat;
  showFormatBadge?:boolean; width:number; aspectRatio?:0.66; }

// 8. ProgressBar — near-completion satisfaction; fills with spring
interface ProgressBarProps { value:number; max:number; accent?:string;
  showPercent?:boolean; animateOnMount?:boolean; }

// 9. LibrarySearchBar — bottom-anchored (thumb zone)
interface LibrarySearchBarProps { value:string; onChange:(q:string)=>void;
  onFocus:()=>void; placeholder?:string; }

// 10. BookListRow — shelf row w/ progress
interface BookListRowProps { userBook:UserBookView; onPress:()=>void; }

// 11. FormatBadge — "E-Book" / "Audio" pill
interface FormatBadgeProps { format:BookFormat; }

// 12. RatingStars — 1–5 input + display
interface RatingStarsProps { value:number; editable?:boolean; onChange?:(n:number)=>void; size?:number; }

// 13. ReviewCard
interface ReviewCardProps { review:ReviewView; canEdit:boolean; onEdit?:()=>void;
  spoilerHidden?:boolean; }

// 14. StatTile — single bento metric
interface StatTileProps { label:string; value:string; delta?:string; icon:string; }

// 15. ReadingHeatmap — GitHub-style calendar
interface ReadingHeatmapProps { days:{date:string;minutes:number}[]; weeks?:number; }

// 16. XpBar — level progress; roll-up animation
interface XpBarProps { totalXp:number; level:number; levelName:LevelName;
  nextLevelXp:number; prevLevelXp:number; }

// 17. BadgeGrid + BadgeTile
interface BadgeGridProps { badges:BadgeView[]; onPress:(slug:string)=>void; }
interface BadgeTileProps { badge:BadgeView; locked:boolean; almostPct?:number; }

// 18. ScannerOverlay — reticle + ISBN capture
interface ScannerOverlayProps { onScan:(isbn:string)=>void; onClose:()=>void; }

// 19. EmptyState — Lottie + copy + CTA
interface EmptyStateProps { lottieKey:string; title:string; body:string;
  ctaLabel?:string; onCta?:()=>void; }

// 20. SkeletonBlock — shimmer
interface SkeletonBlockProps { width:number|string; height:number; radius?:number; }

// 21. SheetScaffold — bottom sheet wrapper. Backdrop is a DARKENED rgba scrim
//      (NOT BlurView/frosted glass) — see "Backdrop policy" below.
interface SheetScaffoldProps { title:string; onClose:()=>void; children:React.ReactNode; hideHeader?:boolean; }

// 22. Confetti — Reanimated particle burst (personal best / milestone)
interface ConfettiProps { fire:boolean; particleCount?:number; colors?:string[]; }

// 23. SwipeCard — Discover (Phase 2)
interface SwipeCardProps { book:DiscoverBook; onSwipe:(dir:'left'|'right'|'up')=>void;
  isTop:boolean; showHint:boolean; }

// 24. SwipeDeck — stack manager, preload at ≤5
interface SwipeDeckProps { initial:DiscoverBook[]; onNeedMore:()=>void; }

// 25. ChallengeCard (Phase 2)
interface ChallengeCardProps { challenge:ChallengeView; progress:number; onJoin:()=>void; }

// 26. GoalProjectionCard — onboarding + Home
interface GoalProjectionCardProps { goalBooks:number; minPerDay:number;
  projectedPages:number; deadlineLabel:string; }

// 27. NotificationRow — settings toggles
interface NotificationRowProps { label:string; value:boolean; onToggle:(b:boolean)=>void; }

// 28. ShareCardCanvas — the view-shot target (Section 10/15)
interface ShareCardCanvasProps { variant:CardVariant; mode:'transparent'|'dark';
  stats:CardStats; levelName:LevelName; bookCoverUrl?:string; }

// 29. AiChatBubble (Phase 3) — 20ms/char reveal, typing indicator
interface AiChatBubbleProps { role:'assistant'|'user'; text:string;
  isTyping?:boolean; revealSpeedMs?:20; }
```

### 4.2 The 5 new components (full spec)

```typescript
// A. ReadingInsightCard — variable-reward reveal (slide-up after share preview)
interface ReadingInsightCardProps {
  insight: { id:string; type:InsightType; text:string; dataSnapshot:Record<string,unknown>; };
  levelName: LevelName;
  onShare: (insightId:string)=>void;     // sets was_shared=true
  onSave:  (insightId:string)=>void;     // swipe-up
  onAutoDismiss: ()=>void;               // after 6s
}
/* State / Reanimated:
   translateY = useSharedValue(SCREEN_H);            // enters from bottom
   on mount: translateY = withSpring(SCREEN_H-200, {damping:18,stiffness:140});
   auto-dismiss: after 6000ms → withTiming(SCREEN_H,{duration:280}) → onAutoDismiss();
   swipe-up GestureDetector: if dragY < -60 → onSave + stay; if dragDown → dismiss early.
   Height 200pt, BlurView intensity 60 over session-complete screen, accent border = type color. */

// B. ComebackChallenge — 3-session recovery widget (Home) + full modal
interface ComebackChallengeProps {
  challenge: { id:string; streakAtBreak:number; sessionsCompleted:0|1|2|3;
               expiresAt:string; };
  levelName: LevelName;
  variant: 'widget' | 'modal';
  onStartSession: ()=>void;
}
/* State / Reanimated:
   segments = [0,1,2].map(i => useSharedValue(i < sessionsCompleted ? 1 : 0));
   on increment: segment fill = withSpring(1,{damping:12,stiffness:160}) + haptic success;
   countdown = useDerivedValue from expiresAt - now (re-derived each focus);
   copy: `${3 - sessionsCompleted} sessions to restore your ${streakAtBreak}-day streak`;
   on 3/3 → emits onComplete → navigate milestone celebration. */

// C. AlmostThereBanner — near-completion (Home)
interface AlmostThereBannerProps {
  kind: 'streak_milestone' | 'badge';
  label: string;            // "3 days to Week Warrior badge 🔥"
  progress: number;         // 0..1
  daysRemaining?: number;
  badgePreviewIcon?: string;
  onPress: ()=>void;
}
/* Reanimated: progress bar fill withTiming(progress,{duration:600,easing:Easing.out});
   subtle glow pulse (withRepeat) only if !reduceMotion. Trigger conditions in Section 5
   near_completion_check / badge_evaluator almost-there. */

// D. MilestoneCelebration — escalating (7/30/100/365)
interface MilestoneCelebrationProps {
  variant: 'normal' | 'bigger' | 'cinematic' | 'legendary';
  streakCount: number;
  levelName: LevelName;
  badge?: BadgeView;
  onShare: ()=>void;
  onClose: ()=>void;
}
/* Behavior by variant (see Section 5 milestone_celebration_type):
   normal:    confetti + XP toast + share prompt
   bigger:    full-screen + auto-generated completion card + prominent share
   cinematic: 5s level-name display (Cormorant Garamond), full-screen Lottie,
              forced share prompt, grants Comeback-Protection badge
   legendary: auto Year-in-Books card, "Literary Legend" reveal, Logos social post (Phase 3)
   Reanimated: scale/opacity sequence; levelName uses withDelay + withTiming reveal. */

// E. LevelNameBadge — identity pill (cards + notif templating + alerts)
interface LevelNameBadgeProps {
  levelName: LevelName;
  context: 'share_card' | 'home' | 'alert';
  mode?: 'transparent' | 'dark';     // share card only
  size?: 'sm' | 'md';
}
/* Render: pill, font Label 10pt bold (share) / 12pt (home).
   share transparent: bg rgba(255,255,255,0.20), text #FFF.
   share dark:        bg #F0B429 (gold), text #FFF.
   home/alert:        bg accent-muted, text accent.
   Fires analytics level_name_displayed {context, level_name} once per mount (Section 18). */
```

---

# SECTION 5 — GAMIFICATION LOGIC (runnable pseudocode)

**Depends on this:** `complete_session` (Section 2), notifications (Section 16), celebrations (Section 4D). This is the engine — *gamification IS the product*.

**Highest-risk decision:** streak math must be **idempotent and timezone-correct**. We key streaks off the session's `local_date` (computed client-side from `timezone_offset_minutes`), not UTC, and we guard against double-increment when an offline session for an already-counted day re-syncs.

**Most common mistake:** awarding a streak day per *session* instead of per *local calendar day*. Reading twice on Tuesday must not give +2 streak. Guard: only increment when `local_date > last_read_local_date`.

```pseudocode
# ---------------------------------------------------------------
# LEVELS (kept in sync with fn_apply_xp SQL trigger, Section 1)
# ---------------------------------------------------------------
LEVELS = [
  {lvl:1, name:'Page Turner',      minXp:0},
  {lvl:2, name:'Margin Scribbler', minXp:500},
  {lvl:3, name:'Chapter Chaser',   minXp:1500},
  {lvl:4, name:'Shelf Builder',    minXp:3500},
  {lvl:5, name:'Spine Cracker',    minXp:7000},
  {lvl:6, name:'Night Reader',     minXp:12000},
  {lvl:7, name:'Bibliophile',      minXp:20000},
  {lvl:8, name:'Tome Raider',      minXp:32000},
  {lvl:9, name:'Literary Athlete', minXp:50000},
  {lvl:10,name:'Logos Legend',     minXp:80000},
]

function level_from_xp(total_xp) -> {level, level_name, next_min, prev_min}:
  chosen = LEVELS[0]
  for L in LEVELS: if total_xp >= L.minXp: chosen = L
  idx = index_of(chosen)
  next_min = idx+1 < len(LEVELS) ? LEVELS[idx+1].minXp : chosen.minXp
  return { level:chosen.lvl, level_name:chosen.name, next_min, prev_min:chosen.minXp }

# ---------------------------------------------------------------
# XP AWARD
# ---------------------------------------------------------------
XP_TABLE = {
  'session_complete': (meta) => 10 + floor((meta.pages_read ?? (meta.minutes_listened/3))*0.5),
  'streak_day':       (meta) => 20 + min(meta.streak, 50),     # caps streak XP growth
  'personal_best':    () => 50,
  'badge':            (meta) => lookup_badge_xp(meta.slug),
  'goal_milestone':   () => 100,
  'comeback_restored':() => 75,
  'challenge_complete': (meta) => meta.xp_reward,
  'review_written':   () => 15,
  'book_finished':    () => 60,
}

function xp_award(user_id, action_type, metadata) -> int:
  amount = XP_TABLE[action_type](metadata)
  INSERT INTO xp_log(user_id, action_type, xp_amount, metadata, session_id)
         VALUES(user_id, action_type, amount, metadata, metadata.session_id)
  # trigger fn_apply_xp updates users.total_xp + level + level_name atomically
  return amount

# ---------------------------------------------------------------
# STREAK CALCULATION  (called inside complete_session)
# ---------------------------------------------------------------
function apply_streak(user_id, local_date) -> {current, incremented, restored_via_grace}:
  st = SELECT * FROM streaks WHERE user_id=user_id FOR UPDATE
  if st is null: st = INSERT default row

  incremented = false; restored = false

  if st.last_read_local_date is null:
      st.current_streak = 1; incremented = true

  elif local_date == st.last_read_local_date:
      # already counted this local day (e.g. 2nd session today, or offline re-sync)
      incremented = false

  elif local_date == st.last_read_local_date + 1 day:
      st.current_streak += 1; incremented = true

  elif local_date == st.last_read_local_date + 2 days
       AND st.grace_used_on is distinct from (st.last_read_local_date + 1 day):
      # 24h grace buffer: one missed day forgiven if read within grace window
      st.grace_used_on = st.last_read_local_date + 1 day
      st.current_streak += 1; incremented = true; restored = true

  elif local_date > st.last_read_local_date:
      # gap too large → streak already broken by cron; this is a fresh start (or comeback session)
      st.current_streak = 1; incremented = true

  # backdating into the past (local_date < last_read): recompute from full history
  if local_date < st.last_read_local_date:
      st.current_streak = recompute_streak_from_sessions(user_id)
      incremented = false

  st.last_read_local_date = max(st.last_read_local_date, local_date)
  st.longest_streak = max(st.longest_streak, st.current_streak)
  st.is_at_risk = false
  st.updated_at = now()
  UPDATE streaks SET ... WHERE user_id=user_id
  return {current: st.current_streak, incremented, restored_via_grace: restored}

# Server cron: break detection (fn_evaluate_streaks)
function evaluate_streak_break(user_id):
  st = SELECT * FROM streaks WHERE user_id=user_id
  local_today = utc_now_to_local_date(user_id.timezone_offset_minutes)
  days_since = local_today - st.last_read_local_date
  if days_since >= 2:                      # missed yesterday AND no grace/freeze
      if has_freeze_token(user_id): consume_freeze(user_id); return
      broken = st.current_streak
      st.current_streak = 0; st.is_at_risk = false
      UPDATE streaks ...
      if broken >= 3: comeback_challenge_trigger(user_id, broken)
      enqueue_push(user_id, 'streak_broken', {N:broken})

function fn_flag_at_risk(user_id):
  local_hour = current_local_hour(user_id)
  read_today = EXISTS(session today local)
  if local_hour >= 18 AND not read_today AND streak.current_streak > 0:
      UPDATE streaks SET is_at_risk=true
      hours_left = 24 - local_hour
      enqueue_push(user_id,'at_risk',{N:streak.current_streak, X:hours_left})

# ---------------------------------------------------------------
# COMEBACK CHALLENGE
# ---------------------------------------------------------------
function comeback_challenge_trigger(user_id, broken_streak_count):
  if broken_streak_count < 3: return null         # no comeback for tiny streaks
  # partial unique index guarantees at most one active
  row = INSERT INTO comeback_challenges
        (user_id, streak_at_break, sessions_completed, started_at, expires_at)
        VALUES (user_id, broken_streak_count, 0, now(), now() + interval '3 days')
        ON CONFLICT (user_id) WHERE active DO NOTHING
        RETURNING *
  if row:
      enqueue_push(user_id,'comeback_challenge_created',{N:broken_streak_count})
      posthog_server('comeback_challenge_shown',{broken_streak_count})
  return row

function comeback_challenge_progress(user_id, session_id) -> challenge|null:
  cc = SELECT * FROM comeback_challenges
       WHERE user_id=user_id AND completed_at IS NULL AND expired_at IS NULL
       FOR UPDATE
  if cc is null: return null
  if now() > cc.expires_at:
      UPDATE comeback_challenges SET expired_at=now() WHERE id=cc.id
      return {status:'expired'}

  cc.sessions_completed += 1
  days_remaining = ceil((cc.expires_at - now()) / 1 day)

  if cc.sessions_completed >= 3:
      cc.completed_at = now(); cc.streak_restored = true
      UPDATE comeback_challenges SET sessions_completed=3, completed_at=now(), streak_restored=true
      # RESTORE streak to its pre-break value (not 0)
      UPDATE streaks SET current_streak = cc.streak_at_break,
                         longest_streak = GREATEST(longest_streak, cc.streak_at_break),
                         last_read_local_date = local_today
      xp_award(user_id,'comeback_restored',{restored_to: cc.streak_at_break})
      enqueue_push(user_id,'comeback_restored',{N:cc.streak_at_break})
      posthog_server('comeback_challenge_completed',
                     {streak_restored_to:cc.streak_at_break,
                      days_taken: ceil((now()-cc.started_at)/1 day)})
      return {status:'completed', restored_to:cc.streak_at_break, sessions_completed:3}
  else:
      UPDATE comeback_challenges SET sessions_completed=cc.sessions_completed
      enqueue_push(user_id,'comeback_challenge_progress',
                   {N:cc.sessions_completed, days:days_remaining})
      posthog_server('comeback_challenge_session_completed',
                     {sessions_done:cc.sessions_completed, days_remaining})
      return {status:'progress', sessions_completed:cc.sessions_completed, days_remaining}

# ---------------------------------------------------------------
# VARIABLE REWARD TRIGGER  (30% gate, 60% if dry 7+ days)
# ---------------------------------------------------------------
function variable_reward_trigger(user_id, session_id) -> insight|null:
  last_insight_at = SELECT max(shown_at) FROM reading_insights WHERE user_id=user_id
  dry = last_insight_at is null OR (now() - last_insight_at) > 7 days
  probability = dry ? 0.60 : 0.30

  # seeded so it "feels random" but is reproducible per session for idempotency
  seed = hash(user_id || session_id)
  roll = seeded_random(seed)                      # 0..1 deterministic
  if roll > probability: return null

  session = SELECT * FROM reading_sessions WHERE id=session_id
  candidates = eligible_insight_types(user_id, session)   # Section 6 data-requirement gates
  # never repeat same type within 7 days
  recent_types = SELECT insight_type FROM reading_insights
                 WHERE user_id=user_id AND shown_at > now()-7 days
  candidates = candidates - recent_types
  # audiobook sessions: exclude PPH-based types (Section 9)
  if session.format=='audiobook':
      candidates = candidates ∩ {CONSISTENCY, PAGE_MILESTONE_TIME, BEST_SESSION_TIME, BOOK_PACE_TIME}
  if candidates is empty: return null

  type = pick_weighted(candidates, seed)
  {text, snapshot} = generate_insight_text(user_id, type, session)   # Section 6 templates
  insight = INSERT INTO reading_insights
            (user_id, session_id, insight_type, insight_text, data_snapshot, shown_at)
            VALUES (user_id, session_id, type, text, snapshot, now())
            RETURNING *
  return insight

# ---------------------------------------------------------------
# BADGE EVALUATOR  (incl. almost-there detection)
# ---------------------------------------------------------------
function badge_evaluator(user_id, trigger) -> newly_unlocked[]:
  metrics = compute_user_metrics(user_id)
            # {streak_days, total_pages, total_sessions, distinct_days, max_pph, books_finished,...}
  unlocked = []
  for a in SELECT * FROM achievements WHERE is_active:
      already = EXISTS user_achievements(user_id,a.id)
      value = metrics[a.unlock_metric]
      if not already AND value >= a.unlock_threshold:
          INSERT user_achievements(user_id,a.id, unlocked_at, progress_value:value)
          unlocked.append(a)
      elif not already AND value >= a.unlock_threshold * a.almost_there_threshold:
          # within 20% (almost_there_threshold default 0.80) → eligible for AlmostThereBanner
          mark_almost_there(user_id, a.slug, pct: value/a.unlock_threshold)
  return unlocked

# ---------------------------------------------------------------
# NEAR-COMPLETION CHECK (streak milestones)
# ---------------------------------------------------------------
STREAK_MILESTONES = [7,30,100,365]
function near_completion_check(user_id) -> alert_data|null:
  cur = streaks.current_streak
  for m in STREAK_MILESTONES:
      if cur < m AND (m - cur) <= 3:
          return { kind:'streak_milestone', target:m, days_remaining:(m-cur),
                   label: (m-cur)+" days to "+badge_name_for(m)+" 🔥",
                   progress: cur/m }
  # also check badge almost-there (within 20%)
  at = SELECT slug,pct FROM almost_there WHERE user_id=user_id ORDER BY pct DESC LIMIT 1
  if at: return { kind:'badge', label:badge_label(at.slug), progress:at.pct }
  return null

# ---------------------------------------------------------------
# MILESTONE CELEBRATION TYPE
# ---------------------------------------------------------------
function milestone_celebration_type(streak_count) -> variant:
  if streak_count == 365: return 'legendary'
  if streak_count == 100: return 'cinematic'
  if streak_count == 30:  return 'bigger'
  if streak_count == 7:   return 'normal'
  if streak_count in [50,200,500,1000]: return 'cinematic'   # extra big round numbers
  return null                                                # no special celebration
```

# SECTION 6 — VARIABLE REWARD LOOP (READING INSIGHTS) — FULL SPEC

**Depends on:** `variable_reward_trigger` (Section 5), `reading_insights` table (Section 1), session-complete timeline (Section 5/4A).

**Highest-risk decision:** insight generation is **server-side inside `complete_session`** so the 30% gate is authoritative and the same session can't produce two different insights across offline re-sync (idempotent via seeded `hash(user_id||session_id)`).

**Most common mistake:** showing generic insights ("Great job reading!"). Every insight must be computed from the user's real data with a concrete number, or it is not generated at all (empty candidate set → no card). A weak insight is worse than no insight — it breaks the variable-reward illusion.

### 6.1 Insight types, data requirements, templates

| Type | Min data | Template | Snapshot keys |
|---|---|---|---|
| `TIME_OF_DAY` | ≥5 sessions w/ timestamps | "You read {pct}% faster in the {part} — your best {k} sessions are all {part} reads." | `{pct, part, k, morningAvgPph, eveningAvgPph}` |
| `PACE_TREND` | ≥10 sessions over 30d | "Your reading speed has increased {pct}% over the last 30 days." | `{pct, pphStart, pphNow}` |
| `GENRE_SPEED` | ≥3 sessions in a genre | "You read {genre} {pct}% faster than your average." | `{genre, pct, genrePph, avgPph}` |
| `CONSISTENCY` | ≥7 days data | "You've read {n} of the last {window} days — more consistent than {percentile}% of readers." | `{n, window, percentile}` |
| `PAGE_MILESTONE` | lifetime pages >500 | "You've now read {pages} pages — about {novels} average novels." | `{pages, novels}` (novels = round(pages/320)) |
| `BEST_SESSION` | ≥10 sessions | "That was your {rank} longest session ever. Your top 3 are all {season}." | `{rank, season, topThree[]}` |
| `BOOK_PACE` | active book + PPH | "At your current pace, you'll finish {title} in {days} days." | `{title, days, remainingPages, recentPph}` |

```pseudocode
function eligible_insight_types(user_id, session) -> set:
  m = compute_user_metrics(user_id)
  e = {}
  if m.sessions_with_ts >= 5 AND time_of_day_skew(user_id) >= 0.10: e += TIME_OF_DAY
  if m.sessions_last_30d >= 10 AND pace_delta_30d(user_id) >= 0.05: e += PACE_TREND
  if genre_sessions(session.genre) >= 3 AND genre_speed_delta(session.genre) >= 0.08: e += GENRE_SPEED
  if m.distinct_days >= 7: e += CONSISTENCY
  if m.total_pages > 500: e += PAGE_MILESTONE
  if m.total_sessions >= 10: e += BEST_SESSION
  if session.user_book.status=='reading' AND m.recent_pph is not null: e += BOOK_PACE
  return e

function generate_insight_text(user_id, type, session) -> {text, snapshot}:
  switch type:
    case TIME_OF_DAY:
       parts = avg_pph_by_part(user_id)              # {morning, afternoon, evening}
       best = argmax(parts); other = avg(parts without best)
       pct = round((parts[best]-other)/other*100)
       k = count_top_sessions_in_part(user_id, best, top=3)
       return {text: f"You read {pct}% faster in the {best} — your best {k} sessions are all {best} reads.",
               snapshot:{pct, part:best, k}}
    ... (one branch per type, all numeric, no fabrications)
```

### 6.2 Trigger probability (authoritative)

- Base **30%** per completed session (`variable_reward_trigger`, Section 5).
- **60%** if no insight shown in **7+ days** (anti-drought).
- **Never** the same `insight_type` twice within **7 days** (subtract recent types from candidate set).
- Audiobook sessions: PPH-based types excluded (Section 9).
- Seeded by `hash(user_id||session_id)` → idempotent across re-sync.

### 6.3 Display behavior

- Slides up from the bottom of the **session-end screen AFTER the share-card preview** has appeared (timeline 2000ms, Section 5).
- Height **200pt**, BlurView intensity 60.
- Stays **6 seconds** then auto-dismisses (`withTiming` 280ms out).
- **Swipe up** → save (persisted; `reading_insights` already stored, just marks "kept"). **Tap Share** → opens share-card composer pre-filled with the insight, sets `was_shared=true`.
- Analytics: `reading_insight_shown` on appear, `reading_insight_shared` / `reading_insight_dismissed` on exit (Section 18).

### 6.4 Viral measurement

`reading_insights.was_shared` + `reading_insight_shared` events feed a viral-coefficient dashboard: `k = shares_per_insight × installs_per_share`. This is why insights are individually persisted rather than ephemeral.

---

# SECTION 7 — COMEBACK CHALLENGE — FULL SPEC

**Depends on:** `comeback_challenges` table + partial unique index (Section 1), `comeback_challenge_trigger` / `_progress` (Section 5), `logos://comeback` deep link (Section 19), ComebackChallenge component (Section 4B).

**Highest-risk decision:** streak restoration writes `current_streak = streak_at_break` (NOT 0, NOT 3). The 3 comeback sessions are the *price of re-entry*, not the new streak value. Getting this wrong silently destroys the loss-aversion payoff.

**Most common mistake:** allowing >1 active comeback (spawns on every break). The partial unique index `one_active_comeback_per_user` + `ON CONFLICT DO NOTHING` prevents this at the DB layer.

### 7.1 Lifecycle

| Stage | Trigger | Effect |
|---|---|---|
| Create | `evaluate_streak_break` fires AND `broken_streak ≥ 3` | Insert row, `expires_at = now()+3d`, push `comeback_challenge_created`, PostHog `comeback_challenge_shown` |
| Progress | each `complete_session` while active | `sessions_completed += 1`, spring animation, push `comeback_challenge_progress` (except on 3rd) |
| Complete | `sessions_completed` reaches 3 | `completed_at=now`, `streak_restored=true`, `streaks.current_streak = streak_at_break`, XP `comeback_restored` (+75), MilestoneCelebration fires, push `comeback_restored` |
| Expire | `now() > expires_at` (cron every 15m) | `expired_at=now`, widget removed, no restoration, push `comeback_challenge_expired` |

### 7.2 Rules

- Only triggers if broken streak was **≥ 3 days** (no comeback for day-1/day-2 breaks).
- **At most ONE active** comeback per user (DB-enforced).
- Window is **3 days** from creation.
- On completion the **full** streak value returns (`streak_at_break`), `last_read_local_date` set to today so the streak continues cleanly.
- Widget lives on **Home, above the bento grid**; full modal at `logos://comeback`.

### 7.3 Copy (with `[LevelName]`)

```
created:   "[LevelName] — your [N]-day streak ended. Complete 3 sessions in 3 days to restore it →"
progress:  "[LevelName] — [k]/3 sessions done. [d] days left to restore your streak."
restored:  "[LevelName] — your [N]-day streak is BACK 🔥 You're unstoppable."
expired:   "Your comeback window closed. Start fresh — every streak begins with session 1."
```

### 7.4 Widget copy / countdown

- Title: `"3 sessions to restore your [N]-day streak."`
- Progress dots: ●●○ with spring fill per completion + success haptic.
- Timer: `"[d] days remaining"` derived from `expires_at`.

> **Benchmark:** comeback users show ~60% higher D30 vs cold-restart users (target to validate in PostHog cohort: `comeback_challenge_completed` cohort vs `streak_broken`-only cohort).

---

# SECTION 8 — OFFLINE SESSION SYNC

**Depends on:** MMKV, NetInfo, `complete_session` idempotency (Section 2), `client_uuid` unique constraint (Section 1).

**Highest-risk decision:** the offline queue stores **fully self-describing sessions including `local_date`** computed at capture time. Streak correctness depends on the day the user *actually read*, not the day they synced. Tuesday-offline → Wednesday-sync must credit Tuesday.

**Most common mistake:** computing `local_date` at sync time → a session read late Tuesday but synced Wednesday gets logged as Wednesday, breaking the streak. Compute and freeze `local_date` when the session ends, offline.

### 8.1 MMKV queue type

```typescript
import { MMKV } from 'react-native-mmkv';
export const sessionQueue = new MMKV({ id: 'logos.session.queue' });

export interface QueuedSession {
  client_uuid: string;          // uuidv4, generated at capture — idempotency key
  user_book_id: string;
  book_id: string;
  format: 'physical' | 'ebook' | 'audiobook';
  started_at: string;           // ISO, device clock
  ended_at: string;             // ISO
  start_page: number | null;
  end_page: number | null;
  minutes_listened: number | null;
  end_position_min: number | null;
  local_date: string;           // 'YYYY-MM-DD' frozen at capture from device tz
  source: 'live' | 'backdated' | 'offline_sync';
  enqueued_at: number;          // epoch ms
  attempts: number;
}

const QUEUE_KEY = 'pending';
const MAX_QUEUE = 50;

export function enqueueSession(s: QueuedSession): void {
  const list: QueuedSession[] = JSON.parse(sessionQueue.getString(QUEUE_KEY) ?? '[]');
  list.push(s);
  // overflow: keep most-recent 50; surface a non-blocking warning toast
  const trimmed = list.length > MAX_QUEUE ? list.slice(list.length - MAX_QUEUE) : list;
  if (list.length > MAX_QUEUE) notifyQueueOverflow(list.length - MAX_QUEUE);
  sessionQueue.set(QUEUE_KEY, JSON.stringify(trimmed));
}
```

### 8.2 Sync function

```typescript
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';

let syncing = false;

export async function drainQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    let list: QueuedSession[] = JSON.parse(sessionQueue.getString(QUEUE_KEY) ?? '[]');
    const remaining: QueuedSession[] = [];
    for (const item of list) {
      try {
        // complete_session is idempotent on (user_id, client_uuid)
        const { data, error } = await supabase.functions.invoke('complete_session', {
          body: { session: { ...item, source: item.source } },
        });
        if (error) throw error;
        // data.deduped === true is also a success (already processed)
        // celebrations for synced sessions are suppressed unless app foregrounded on this item
      } catch (e) {
        item.attempts += 1;
        if (item.attempts < 8) remaining.push(item);   // drop after 8 tries → log to Sentry
        else reportSyncDrop(item);
      }
    }
    sessionQueue.set(QUEUE_KEY, JSON.stringify(remaining));
  } finally { syncing = false; }
}

// Listener: sync whenever connectivity returns
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) drainQueue();
});
```

### 8.3 ON CONFLICT handling

Server side, `complete_session` first does:
```sql
SELECT id FROM reading_sessions WHERE user_id=$1 AND client_uuid=$2;
-- if found: return {deduped:true}; else proceed with INSERT (unique(user_id,client_uuid) is the backstop)
```
The unique constraint guarantees that even a race between two sync attempts cannot double-insert.

### 8.4 Worked example — streak preservation

1. **Tuesday 23:50** (airplane mode): session ends. `local_date='Tue'`, `client_uuid=A` enqueued.
2. **Wednesday 08:00** online: `drainQueue` → `complete_session({local_date:'Tue', client_uuid:A})`.
3. Server `apply_streak('Tue')`: since `last_read_local_date` was Monday, `Tue == Mon+1` → increment. Streak preserved on the day it was earned.
4. Wednesday cron `evaluate_streak_break` ran at Wed-local-midnight *before* sync? → It would see `last_read=Mon`, `days_since=2` → would break. **Mitigation:** cron checks a 24h grace buffer (`apply_streak` grace branch) AND the comeback only fires for `≥3`. If a break did fire, the Tuesday sync's `apply_streak` restores via the grace/recompute branch (`recompute_streak_from_sessions`) because the Tuesday row now exists. The recompute is the safety net for late sync.

### 8.5 Comeback progress from offline sessions

`complete_session` calls `comeback_challenge_progress` for **every** session including synced ones, in `client_uuid` order. Each unique `client_uuid` increments at most once (dedup guard returns early before progress runs). So 2 offline comeback sessions synced together correctly advance 0→1→2.

---

# SECTION 9 — BOOK FORMAT DATA MODEL

**Depends on:** `book_format` enum, `reading_sessions` CHECK constraint (Section 1), insight exclusion (Section 6), session timer UI (Section 4).

**Highest-risk decision:** audiobooks share the *same* `reading_sessions` table but with `pages_read NULL` and `minutes_listened NOT NULL`, enforced by a CHECK constraint. This keeps streaks/XP/comeback format-agnostic while keeping PPH math honest.

**Most common mistake:** computing PPH or page-based stats across a mixed library without guarding `format='audiobook'` → NaN/Infinity in averages. Every aggregate must filter or COALESCE.

### 9.1 Per-format model

| Aspect | physical | ebook | audiobook |
|---|---|---|---|
| Progress unit | page | page | minute |
| Catalog field | `page_count` | `page_count` | `duration_minutes` |
| Shelf override | `page_count_override` | `page_count_override` | `total_duration_minutes` |
| Session writes | `start/end_page`, `pages_read`, `pph` | same | `minutes_listened`, `end_position_min` |
| Pace metric | PPH | PPH | hrs/book |
| Card badge | none | "E-Book" | "Audio" |
| ETF (est. time to finish) | `remaining_pages / recent_pph` (hrs) | same | `(duration - position) min` |

### 9.2 ETF per format

```pseudocode
function etf(user_book) -> {value, unit}:
  if format in (physical,ebook):
     remaining = page_count - current_page
     pph = recent_pph(user_id, book) ?? 60     # default 60 PPH before data
     return { value: remaining/pph, unit:'hours' }
  else: # audiobook
     remaining = total_duration_minutes - current_position_min
     return { value: remaining, unit:'minutes' }
```

### 9.3 Mixed-library stats aggregation

```sql
-- pages stats: physical+ebook only
select coalesce(sum(pages_read),0) as lifetime_pages
from reading_sessions where user_id=$1 and format in ('physical','ebook');

-- time stats: ALL formats (duration_seconds always present)
select coalesce(sum(duration_seconds),0)/3600.0 as lifetime_hours
from reading_sessions where user_id=$1;

-- books finished: format-agnostic
select count(*) from user_books where user_id=$1 and status='finished';

-- avg PPH: guard audiobook
select avg(pph) from reading_sessions
where user_id=$1 and format in ('physical','ebook') and pph is not null;
```

### 9.4 Session timer UI per format

- **physical/ebook:** timer + (on tap) PPH + page progress bar; stop prompts for `end_page`.
- **audiobook:** timer + (on tap) "listening" label + minute progress bar; stop prompts for `end_position` (minutes) — **no page entry, no PPH counter rendered**.

### 9.5 Insight + comeback behavior

- Variable-reward: audiobook sessions **exclude** PPH-based types (`TIME_OF_DAY`/`PACE_TREND`/`GENRE_SPEED` when computed on PPH). Allowed: `CONSISTENCY`, time-based `BEST_SESSION`, time-based `BOOK_PACE`, `PAGE_MILESTONE` (lifetime pages from non-audio).
- Comeback challenge counts audiobook sessions **identically** — any completed session of any format advances the 0/3 progress.

# SECTION 10 — TRANSPARENT PNG SHAREABLE CARD — FULL SPEC

**Depends on:** `react-native-view-shot`, `LevelNameBadge` (Section 4E), share composer route (Section 3), Branch share URLs (Section 15/19).

**Highest-risk decision:** **transparency works reliably only on iOS** with view-shot `format:'png'`. On Android, transparent PNG capture of a `BlurView`/elevation surface is unreliable `[VERIFY]`. **Decision:** offer Transparent as the default on iOS; on Android, default to Dark and present Transparent as "beta" with a flattened (no-blur) capture path. This avoids shipping broken transparent shares on Android.

**Most common mistake:** capturing the on-screen preview node (which has a checkerboard transparency background) → the checkerboard bakes into the PNG. **Always capture an off-screen clone** that has no preview background.

### 10.1 Component structure

```
ShareCardCanvas (collapsable={false}, the view-shot ref target)
├── <Background>                    // transparent mode: transparent; dark mode: #0F1115 gradient
├── <CoverThumb> (optional)         // book cover, top-left, radius 12, shadow
├── <HeadlineStat>                  // big number: pages | minutes | streak (tabular figures)
├── <SubStats row>                  // 2–3 secondary stats
├── <FormatBadge> (if ebook/audio)
├── <LevelNameBadge context="share_card" mode={mode} />   // identity pill
└── <LogosWordmark>                 // bottom-right (badge goes bottom-left if so)
```

### 10.2 view-shot config

```typescript
import ViewShot, { captureRef } from 'react-native-view-shot';

const SHOT_CONFIG = {
  format: 'png' as const,    // PNG required for transparency (JPEG cannot be transparent)
  quality: 1,
  result: 'tmpfile' as const,
  // 2× density for crisp share:
  width: 1080,               // logical 540pt × 2
  height: 1350,              // 4:5 portrait, logical 675pt × 2
} as const;

async function captureCard(ref: React.RefObject<View>, mode:'transparent'|'dark') {
  return captureRef(ref, {
    ...SHOT_CONFIG,
    // iOS honors transparent backgroundColor; Android beta path flattens
    ...(mode === 'transparent' ? {} : { backgroundColor: '#0F1115' }),
  });
}
```

### 10.3 Text shadow values (legibility over arbitrary user backgrounds)

Because a transparent card is overlaid on an unknown photo, all text needs a shadow:
```typescript
const cardTextShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};
const headlineShadow = {
  textShadowColor: 'rgba(0,0,0,0.65)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 10,
};
```

### 10.4 Background handling

- **Transparent mode:** root `backgroundColor:'transparent'`; preview screen shows a checkerboard *behind* the off-screen node (never inside it).
- **Dark mode:** `#0F1115` base with a subtle radial emerald glow (`#00D26A` at 8% opacity).

### 10.5 Toggle UI (Transparent / Dark)

A segmented control at the top of the composer:
```
[ Transparent ]  [ Dark ]
```
- iOS: defaults Transparent. Android: defaults Dark; Transparent shows a "Beta" tag.
- Live preview updates instantly (mode is a prop to `ShareCardCanvas`).
- Below: 4 small variant chips (Session / Streak / Book Finished / Year in Books).

### 10.6 Level name badge placement

- Pill, bottom-right of card **unless** the Logos wordmark occupies bottom-right — then badge goes **bottom-left**.
- Transparent: `bg rgba(255,255,255,0.20)`, text `#FFFFFF`. Dark: `bg #F0B429` (gold), text `#FFFFFF`. Font: Label 10pt bold.
- Always present on all 4 variants × 2 modes (Section 15).

### 10.7 Share text template

```
"[N] pages in [duration] · [LevelName] on Logos 📖🔥
Track every word you read → [branchShareUrl]"
```

---

# SECTION 11 — DYNAMIC ISLAND & ANDROID LIVE NOTIFICATION

**Depends on:** `live_session_state` table (Section 1), session tracker route (Section 3), deep link `logos://session/:id` (Section 19).

**Highest-risk decision — Architecture (A/B/C):**

| Option | Approach | Verdict |
|---|---|---|
| **A** | `react-native-live-activities` community lib `[VERIFY]` for iOS ActivityKit + expo-notifications foreground service for Android | **Chosen for Phase 1** if the lib supports SDK 51+ and ActivityKit `ContentState` updates via push token. Fastest path. |
| B | Custom Swift ActivityKit module via Expo Modules API (iOS) + custom Kotlin foreground service (Android) | Most control; required if A is unmaintained. Fallback. |
| C | No Live Activity; rich local notification only | Loses the visceral Dynamic Island differentiator — rejected; it's a core north-star feature. |

**Decision:** **Option A**, with a hard fallback plan to **B** (custom Expo native modules) gated behind a 1-week spike in Phase 1 to verify the library against Expo SDK + ActivityKit push updates. If the spike fails, switch to B (budget +1.5 wk). **Most common mistake:** assuming ActivityKit updates can be driven from JS at 1s cadence — they cannot; iOS throttles updates. Drive coarse updates (page/elapsed at ~30–60s or on state change) via `ContentState`, and let the in-app timer be the fine-grained clock.

### 11.1 iOS ActivityKit payload

```swift
// Swift Activity attributes + dynamic content state
struct LogosSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var elapsedSeconds: Int
    var currentPage: Int
    var goalPage: Int
    var pagesRead: Int
    var bookTitle: String
    var format: String           // "physical" | "ebook" | "audiobook"
  }
  var sessionId: String
  var coverUrlString: String
  var levelName: String          // identity everywhere
}
```
```typescript
// JS payload passed to the native start/update bridge
interface LiveActivityPayload {
  sessionId: string; coverUrl: string; levelName: string;
  state: { elapsedSeconds:number; currentPage:number; goalPage:number;
           pagesRead:number; bookTitle:string; format:string; };
}
```

### 11.2 The four states

| State | Content |
|---|---|
| **Compact (leading/trailing)** | leading: 📖 book glyph; trailing: elapsed `MM:SS` (tabular) |
| **Minimal** (multi-activity) | emerald flame dot |
| **Expanded** (long-press) | cover thumb · book title · elapsed · page progress bar · `pagesRead` · level-name pill · "Tap to open" |
| **Lock screen / banner** | full-width: cover · title · big elapsed · progress bar · `[LevelName]` · End button |

Tap anywhere → deep link `logos://session/:sessionId` → resumes the full tracker.

### 11.3 Update triggers

- On start (activity request).
- On page-progress change (user taps "I'm on page N" in tracker).
- Every **~30–60s** elapsed tick (coarse), via `Activity.update(ContentState)`.
- On pause/resume/end (final update then `Activity.end(dismissalPolicy:.immediate)`).
- `[VERIFY]` background updates beyond ~8h require a push-token-driven update; for a reading session this is rarely needed.

### 11.4 Android foreground service notification

- **Notification channel:** `logos_session` (IMPORTANCE_LOW so it's silent/ongoing, not buzzing).
- **Foreground service** started via `expo-notifications` + `expo-task-manager` `[VERIFY]` (Android 14 requires a declared `foregroundServiceType` — use `mediaPlayback`-style/`shortService` as appropriate `[VERIFY]`).
- **Ongoing notification** (`ongoing:true`, not swipe-dismissable while active): cover · title · elapsed · progress · End action button.
- **30s update cadence** via the task manager updating the same notification id. Battery: stop service immediately on session end.

### 11.5 Session behavior with Live Activity active

- The in-app `SessionTimer` (UI thread) is the fine clock; Live Activity shows coarse updates.
- Ending the session in-app ends the Activity; ending from the Live Activity End button deep-links into the app's stop flow (must finalize `end_page`).
- If the app is killed, Android foreground service keeps the notification; on relaunch, reconcile `live_session_state.is_active`.

### 11.6 Focus mode opt-in

- "Focus mode" toggle on the tracker → enables system Focus integration + invisible UI (timer only). Opt-in, persisted in `users.tooltip_seen_map`/prefs. Disclose Live Activity usage in privacy policy (Section 21).

---

# SECTION 12 — EMPTY, ERROR & SKELETON STATES

**Depends on:** `EmptyState` (Section 4-19), Lottie (≤150KB), every list screen.

**Highest-risk decision:** the **Reading Insights empty state must motivate, not apologize** — it teaches the variable-reward loop exists without promising when it fires.

**Most common mistake:** blank screens during load → users think the app is broken. Every async region renders a skeleton within 100ms.

### 12.1 Empty states

| Screen | Lottie | Title | Body | CTA |
|---|---|---|---|---|
| Library | open book | "Your shelf is empty." | "Add your first book to start tracking." | Add a Book |
| Stats | sprout/chart | "No stats yet." | "Finish a session and your numbers appear here." | Start Reading |
| TBR | stacked books | "Nothing on deck." | "Swipe to discover your next read." | Discover |
| Discover | compass | "You're all caught up." | "Check back for fresh picks." | — |
| Reviews | quill | "No reviews yet." | "Rate a book to share your take." | — |
| **Reading Insights** | spark | "No insights yet." | "Complete more sessions to unlock personalized reading insights." | Start Reading |
| **Comeback (expired)** | extinguished flame | "Your comeback window closed." | "Start fresh today — every streak begins with one session." | Start Reading |

### 12.2 Error states (per failure mode)

| Failure | UI | Recovery |
|---|---|---|
| Book search API down | inline banner "Search unavailable — try again." | Retry button; fall back to Open Library |
| Cover image fails | `expo-image` placeholder (spine glyph + title) | auto |
| Session save offline | toast "Saved offline — will sync." | auto on reconnect |
| `complete_session` 5xx | non-blocking toast; session stays queued | auto retry (8×) |
| Claude AI timeout | "Recs are taking a moment." fallback to cached/genre-based | Retry |
| Push token failure | silent; retry registration next launch | auto |
| Auth expired | redirect to sign-in with toast | re-auth |

### 12.3 Skeleton shimmer specs

- `SkeletonBlock`: base `#1A1D24`, shimmer sweep `#2A2F38`, Reanimated `withRepeat(withTiming(...,1000ms,linear))` translateX gradient; respects reduced-motion (static dim block).
- Library: 6 row skeletons (cover 48×72 + 2 text lines). Home bento: tile-shaped skeletons matching final layout (no layout shift). Stats: heatmap grid + 4 stat tiles.

---

# SECTION 13 — ONBOARDING PROJECTION CALCULATION

**Depends on:** goal onboarding screen (Section 3), `reading_goals`, Home re-projection.

**Highest-risk decision:** projection must compute **instantly with sane defaults** before any real reading data exists (300 pages/book, 60 PPH). After real data accrues, swap defaults for the user's measured averages.

**Most common mistake:** dividing by `days_remaining=0` in late December → Infinity. Clamp to ≥1 and special-case December.

```typescript
interface ReadingProjection {
  goalBooks: number;
  daysRemaining: number;
  booksPerDay: number;
  minPerDay: number;        // recommended daily minutes
  projectedBooks: number;
  projectedPages: number;
  deadlineLabel: string;    // "by Dec 31"
}

const DEFAULT_PAGES_PER_BOOK = 300;
const DEFAULT_PPH = 60;

export function useReadingProjection(userId: string, goalBooks: number): ReadingProjection {
  const { avgPph, avgPagesPerBook } = useUserAverages(userId); // null before data
  const pph        = avgPph ?? DEFAULT_PPH;
  const pagesBook  = avgPagesPerBook ?? DEFAULT_PAGES_PER_BOOK;

  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const msLeft = yearEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(msLeft / 86_400_000)); // clamp ≥1

  const booksPerDay   = goalBooks / daysRemaining;
  const pagesPerDay   = booksPerDay * pagesBook;
  const minPerDay     = Math.max(5, Math.round((pagesPerDay / pph) * 60)); // floor 5 min
  const projectedPages = Math.round(goalBooks * pagesBook);

  return {
    goalBooks, daysRemaining, booksPerDay,
    minPerDay, projectedBooks: goalBooks, projectedPages,
    deadlineLabel: `by Dec 31`,
  };
}
```

Onboarding copy (RULE 3): *"At {minPerDay} min/day, you'll read ~{goalBooks} books and {projectedPages} pages by Dec 31."*

### Edge cases

- **Goal set in December:** `daysRemaining` small → `minPerDay` large; cap displayed value with copy "an ambitious finish — {minPerDay} min/day" and offer "set goal for next year instead."
- **Goal changed post-onboarding:** Home re-runs the hook with real averages; projection updates live.
- **0 sessions:** defaults (300/60) used; flagged internally `isEstimate:true` so Home can label "estimated — improves as you read."

# SECTION 14 — BOOK SWIPE SYSTEM (Phase 2)

**Depends on:** Google Books API, `swipe_history` (Section 1), `SwipeCard`/`SwipeDeck` (Section 4), `has_seen_swipe_hint` (users).

**Highest-risk decision:** gesture + animation run **entirely on the UI thread** via Reanimated `Gesture.Pan()` + `useAnimatedStyle`. Touching the JS thread per frame (e.g. setState on drag) tanks low-end Android to <30fps.

**Most common mistake:** re-rendering the whole deck on each swipe. Render only top 2–3 cards; recycle. Pre-fetch candidates before the stack empties.

### 14.1 Candidate sourcing

```typescript
// Source from Google Books by user genres, excluding already-swiped/shelved
async function fetchCandidates(userId: string, genres: string[], excludeIds: Set<string>) {
  const q = genres.map(g => `subject:${g}`).join('+OR+');
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=40&orderBy=relevance`);
  const items = (await res.json()).items ?? [];
  return items
    .filter(b => !excludeIds.has(b.id) && b.volumeInfo?.imageLinks?.thumbnail)
    .map(toDiscoverBook);
}
```

### 14.2 Stack preload

- Maintain a buffer of **20** cards. When `remaining ≤ 5`, `onNeedMore` fires `fetchCandidates` (append, dedupe against `swipe_history` + shelf).
- Persist a rolling `excludeIds` set (last 500 swiped `google_books_id`).

### 14.3 Reanimated gesture handler

```typescript
const tx = useSharedValue(0), ty = useSharedValue(0);
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

const pan = Gesture.Pan()
  .onUpdate(e => { tx.value = e.translationX; ty.value = e.translationY * 0.5; })
  .onEnd(e => {
    if (e.translationX >  SWIPE_THRESHOLD) flyOut('right', e.velocityX);   // save
    else if (e.translationX < -SWIPE_THRESHOLD) flyOut('left', e.velocityX); // pass
    else if (e.translationY < -SWIPE_THRESHOLD) flyOut('up', e.velocityY);   // superlike
    else { tx.value = withSpring(0); ty.value = withSpring(0); }            // snap back
  });

const cardStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: tx.value }, { translateY: ty.value },
    { rotate: `${interpolate(tx.value, [-SCREEN_W, SCREEN_W], [-8, 8])}deg` }, // ±8° tilt
  ],
}));
// directional overlays: LIKE (emerald) opacity from +tx, NOPE (red) from -tx, SAVE (blue) from -ty
```

`flyOut` animates `tx`/`ty` off-screen via `withTiming`, then `runOnJS(commitSwipe)(direction)` → insert `swipe_history` + advance index. Haptic on each commit.

### 14.4 Dedup

- `swipe_history` has `unique(user_id, google_books_id)`. Insert with `ON CONFLICT DO NOTHING`.
- Right-swipe (save) also inserts a `user_books` row with `status='want'`.

### 14.5 First-open hint + passive hint

- First Discover open (`!has_seen_swipe_hint`): one-time **±6° tilt** animation on the top card (`withSequence(withTiming(6°), withTiming(-6°), withTiming(0))`) + "Swipe right to save, left to pass." Set `has_seen_swipe_hint=true`.
- Passive hint: if a card sits untouched 4s, a subtle 3° wiggle re-cues.

### 14.6 Low-end Android performance

- Only top 3 cards mounted; cards 2–3 are static (no gesture).
- `expo-image` with `recyclingKey`, `cachePolicy:'memory-disk'`, downscaled thumbnails.
- No BlurView on cards (Android blur is expensive) — use rgba overlays.
- `removeClippedSubviews`, fixed card dimensions (no layout measurement per frame).

---

# SECTION 15 — SHAREABLE CARD TECHNICAL PLAN

**Depends on:** Section 10 (card spec), Branch.io (Section 19), view-shot.

**Highest-risk decision:** render the capture target **off-screen** at fixed 1080×1350 so device width never changes output dimensions; the visible preview is a scaled copy.

**Most common mistake:** capturing while images are still loading → blank cover in the PNG. Await cover load (`onLoadEnd`) before enabling the Share button.

### 15.1 The 8 designs (4 variants × 2 modes)

| Variant | Headline | Sub-stats | Trigger |
|---|---|---|---|
| Session | pages (or minutes) this session | duration · PPH · book title | after session-end |
| Streak | "[N]-day streak 🔥" | longest · this week · level | streak milestones |
| Book Finished | "Finished [Title]" | days to read · rating · pages | status→finished |
| Year in Books | books this year | pages · hours · top genre | Dec / 365 milestone |

Each renders in **Transparent** and **Dark** (Section 10). `LevelNameBadge` on all 8.

### 15.2 Off-screen render

```typescript
// Mounted absolutely off-screen; never visible, always full-res
<View style={{ position:'absolute', left:-9999, top:0 }} pointerEvents="none">
  <ViewShot ref={shotRef} collapsable={false}>
    <ShareCardCanvas variant={variant} mode={mode} stats={stats}
                     levelName={levelName} bookCoverUrl={cover}
                     onCoverReady={() => setReady(true)} />
  </ViewShot>
</View>
```
Share button `disabled={!ready}`.

### 15.3 iOS vs Android

| | iOS | Android |
|---|---|---|
| Transparent PNG | reliable, default | beta, flattened path `[VERIFY]` |
| Capture lib | `captureRef` ok | `captureRef`; avoid capturing `BlurView` (flatten to rgba) |
| Share sheet | native `Share`/`expo-sharing` | `expo-sharing` |
| Pasteboard transparency | preserved | may drop alpha `[VERIFY]` — prefer file share |

### 15.4 Branch.io share URLs

```typescript
const branchLink = await branch.createBranchUniversalObject(`card/${cardId}`, {
  title: 'My reading on Logos',
  contentImageUrl: uploadedCardUrl,       // uploaded to Supabase Storage (public bucket)
  contentMetadata: { customMetadata: { card_id: cardId, level_name: levelName } },
}).generateShortUrl({ feature:'share', channel:'card' });
```
Deferred deep link: a new install from the link opens to the referenced book/card (Section 19).

---

# SECTION 16 — PUSH NOTIFICATION ARCHITECTURE

**Depends on:** `expo_push_token`, `notification_settings`, `users.level_name` + `timezone_offset_minutes` (Section 1), pg_cron (Section 2), `send_push` edge fn.

**Highest-risk decision:** templating pulls `level_name` from `users` at **send time** (inside `send_push`), not at schedule time — so the identity is fresh even if the user leveled up between scheduling and sending.

**Most common mistake:** scheduling per-user cron rows. Instead, run hourly UTC jobs that bucket users by `timezone_offset_minutes` and compute "is it 18:00/midnight/reminder-hour in their local time this UTC hour?"

### 16.1 Templates (all include `[LevelName]`)

```
at_risk:                    "[LevelName] — your [N]-day streak ends in [X] hours"
streak_broken:              "[LevelName] — your [N]-day streak ended. Start your comeback now →"
comeback_challenge_created: "[LevelName] — [N]-day streak ended. Complete 3 sessions in 3 days to restore it →"
comeback_challenge_progress:"[LevelName] — [k]/3 sessions done. [d] days left to restore your streak."
comeback_challenge_expired: "Your comeback window closed. Start fresh — every streak begins with session 1."
comeback_restored:          "[LevelName] — your [N]-day streak is BACK 🔥"
daily_reminder:             "[LevelName] — [BookTitle] is waiting on page [N]."
weekly_digest:              "[LevelName] — this week: [P] pages, [S] sessions. [BestStat] 🔥"
goal_milestone:             "[LevelName] — you're halfway to your [N]-book goal."
almost_there:               "[LevelName] — [N] days to [BadgeName] badge 🎯"
reading_insight:            "[LevelName] — you've unlocked a personal reading insight 💡"
long_absence_3d:            "[LevelName] — it's been 3 days. [BookTitle] is waiting on page [N]."
```

Each notification carries a `data.deepLink` (e.g. `logos://comeback`, `logos://session/:id`, `logos://insights`).

### 16.2 `send_push` edge function

```pseudocode
function send_push(user_ids[], notif_type, vars):
  rows = SELECT id, expo_push_token, level_name, theme FROM users
         WHERE id = ANY(user_ids) AND expo_push_token IS NOT NULL
  settings = SELECT * FROM notification_settings WHERE user_id = ANY(user_ids)
  messages = []
  for u in rows:
     s = settings[u.id]
     if not s.enabled OR not channel_enabled(s, notif_type): continue
     if in_quiet_hours(u, s): defer_to(s.quiet_hours_end); continue
     body = render_template(notif_type, { LevelName:u.level_name, ...vars[u.id] })
     messages.push({ to:u.expo_push_token, title:'Logos', body,
                     data:{ deepLink: deep_link_for(notif_type, vars[u.id]) },
                     sound:'default', priority:'high' })
  # Expo push API: batch ≤100
  for batch in chunk(messages,100):
     resp = POST https://exp.host/--/api/v2/push/send  body=batch
     handle_receipts(resp)   # DeviceNotRegistered → null the token
```

### 16.3 pg_cron schedule (UTC, bucketed by tz)

| Notif | When (user local) | Cron |
|---|---|---|
| at_risk | 18:00, no read today | hourly |
| daily_reminder | `daily_reminder_hour` | hourly |
| weekly_digest | Sun 18:00 | hourly |
| comeback_* | event-driven (break / progress / expire) | on event + 15m expiry sweep |
| long_absence_3d | 3 local days idle | hourly |
| goal_milestone / almost_there | event-driven on threshold crossing | inside complete_session / badge_evaluator |
| reading_insight | event-driven when insight generated (optional re-engage if app backgrounded) | on event |

### 16.4 Token management

- Register token after **first completed session** (RULE 7 — permission at point of use).
- Store one token per user (latest device). On `DeviceNotRegistered` receipt → set `expo_push_token=NULL`.
- Re-register on app launch if token changed.

---

# SECTION 17 — CLAUDE API INTEGRATION (Phase 3)

**Depends on:** `ai_rec_cache` (Section 1), `ai_recommend` edge fn, conversational recs screen (Section 3).

**Highest-risk decision:** the API key lives **only** in the edge function (Supabase secret), never the client. Responses are validated against a strict schema and cached by `prompt_hash` for 7 days to control cost.

**Most common mistake:** trusting model output shape. Always validate; on malformed JSON, fall back to genre-based recs rather than crashing the chat UI.

### 17.1 Full system prompt (verbatim)

```
You are Logos's in-app literary guide. Logos is a reading-tracker app whose users
think of themselves as serious, committed readers — "literary athletes." Your job is
to recommend books that fit the reader's stated mood and history, in a warm,
literate, concise voice. You are a well-read friend, not a salesperson.

CONTEXT YOU RECEIVE
- mood: a short phrase the reader typed (e.g. "something hopeful but not naive").
- recent_books: titles/authors/genres/ratings the reader recently finished or rated.
- favorite_genres: the reader's selected genres.
- disliked_signals: books they passed on (swiped left) if provided.

HOW TO RECOMMEND
1. Recommend exactly 3 books unless asked otherwise.
2. Match the MOOD first, the genres second. Mood is the strongest signal.
3. Prefer books the reader is unlikely to have already read; never recommend a title
   present in recent_books.
4. Vary the picks: do not recommend three near-identical books. Offer range.
5. For each book give: title, author, a one-sentence reason tied to THIS reader's
   mood/history (not a generic blurb), and a 2-6 word vibe tag.
6. Be honest about content. If a book is heavy, say so briefly.
7. Never invent books. If unsure a title exists, choose a well-known real one.
8. Keep each reason under 30 words. No spoilers.

TONE
- Literate but plain. No purple prose, no clichés ("page-turner", "gripping").
- Speak to the reader as a peer who reads seriously.
- Never mention that you are an AI or describe your process.

OUTPUT FORMAT — respond with ONLY valid JSON, no prose before or after:
{
  "intro": "one short sentence acknowledging their mood",
  "recommendations": [
    { "title": "string", "author": "string", "reason": "string",
      "vibe": "string", "genre": "string" }
  ]
}
If you cannot recommend confidently, return:
{ "intro": "string", "recommendations": [] }
```

### 17.2 Request payload + call

```typescript
interface AiRecRequest {
  mood: string;
  recent_books: { title:string; author:string; genre:string; rating?:number }[];
  favorite_genres: string[];
  disliked_signals?: { title:string; author:string }[];
}

// inside edge function (Deno)
const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method:'POST',
  headers:{ 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
            'anthropic-version':'2023-06-01', 'content-type':'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: LOGOS_SYSTEM_PROMPT,                 // text above; sent as system param
    messages: [{ role:'user', content: JSON.stringify(req) }],
  }),
});
```

### 17.3 Response validation

```typescript
const Rec = z.object({ title:z.string(), author:z.string(), reason:z.string().max(220),
                       vibe:z.string(), genre:z.string() });
const RecResponse = z.object({ intro:z.string(), recommendations:z.array(Rec).max(5) });

function parseClaude(text:string): RecResponse {
  const json = JSON.parse(extractFirstJsonBlock(text));   // tolerate stray whitespace
  return RecResponse.parse(json);                          // throws → fallback
}
```

### 17.4 Caching

- Key: `prompt_hash = sha256(mood + sorted(recent_book_ids) + sorted(genres))`.
- On request: check `ai_rec_cache` where `expires_at > now()` → return cached (`cached:true`).
- Else call Claude, store with `expires_at = now()+7d`.

### 17.5 Cost projection `[VERIFY]`

`[VERIFY]` pricing against current Anthropic rate card. Rough: input ~600 tokens (system+context) + output ~400 tokens per call. With 7-day cache and ~1 fresh rec set/user/week, cost scales ~linearly with WAU on cache misses. Budget alarm at the edge-function level; cap 5 fresh calls/user/day (rate limit below).

### 17.6 Rate limiting + fallback

- Per-user: max **5 fresh** (uncached) calls/day (counter in `ai_rec_cache` or a Redis/`kv`); beyond → serve last cached or genre-based.
- Global: respect Anthropic 429 with exponential backoff; circuit-breaker → genre-based recs for 5 min.
- **Fallback recs:** deterministic genre-popularity list from Google Books (`orderBy=relevance` on favorite genres) so the chat never dead-ends.

# SECTION 18 — ANALYTICS IMPLEMENTATION

**Depends on:** PostHog RN SDK (self-hosted), `user_id` as `distinct_id`, server capture for cron-only events.

**Highest-risk decision:** events fired by both client and server use the **same `distinct_id = user_id`** so funnels stitch. Server-only events (expiry, cron) use PostHog's HTTP capture API.

**Most common mistake:** loose property bags. Every event below has an exact typed shape; emit nothing extra without updating this schema.

### 18.1 Setup

```typescript
import PostHog from 'posthog-react-native';
export const posthog = new PostHog(POSTHOG_KEY, {
  host: 'https://analytics.logos.app',   // self-hosted DigitalOcean
  captureAppLifecycleEvents: true,
  flushAt: 20, flushInterval: 30,
});
// identify after auth:
posthog.identify(userId, { level_name: levelName, subscription_status, theme, is_minor });
```

### 18.2 Event schema (exact properties)

```typescript
type AnalyticsEvents = {
  // onboarding
  onboarding_started:        {};
  age_gate_passed:           { age_band: 'under13'|'13-17'|'adult' };
  onboarding_genre_selected: { genres: string[] };
  onboarding_goal_set:       { goal_books: number; min_per_day: number };
  onboarding_completed:      { duration_ms: number; skipped_steps: number };
  // library
  book_added:                { book_id: string; format: 'physical'|'ebook'|'audiobook'; source: 'search'|'scan'|'swipe' };
  book_scanned:              { isbn: string; matched: boolean };
  book_finished:             { book_id: string; days_to_finish: number; rating: number|null };
  review_written:            { book_id: string; rating: number; has_body: boolean };
  // sessions
  session_started:           { user_book_id: string; format: string; source: 'live'|'backdated' };
  session_completed:         { session_id: string; format: string; pages_read: number|null; minutes: number; pph: number|null; is_personal_best: boolean; source: 'live'|'backdated'|'offline_sync' };
  session_backdated:         { session_id: string; days_ago: number };
  // gamification
  streak_incremented:        { current_streak: number; via_grace: boolean };
  streak_at_risk_shown:      { current_streak: number; hours_left: number };
  streak_broken:             { broken_streak_count: number };
  xp_awarded:                { action_type: string; xp_amount: number };
  level_up:                  { new_level: number; level_name: string };
  badge_unlocked:            { badge_slug: string; xp_reward: number };
  milestone_celebration_type:{ streak_count: number; celebration_variant: 'normal'|'bigger'|'cinematic'|'legendary' };
  level_name_displayed:      { context: 'notification'|'share_card'|'home'|'alert'; level_name: string };
  // variable reward
  reading_insight_shown:     { insight_type: string; session_id: string; was_first_insight: boolean };
  reading_insight_shared:    { insight_type: string; platform: string };
  reading_insight_dismissed: { insight_type: string; time_shown_ms: number };
  // comeback
  comeback_challenge_shown:           { broken_streak_count: number };
  comeback_challenge_session_completed:{ sessions_done: number; days_remaining: number };
  comeback_challenge_completed:        { streak_restored_to: number; days_taken: number };
  comeback_challenge_expired:          { sessions_completed: number; broken_streak_count: number };
  // near-completion
  almost_there_shown:        { badge_slug: string; days_remaining: number; trigger: 'streak_milestone'|'badge' };
  // share cards
  share_card_opened:         { variant: string; mode: 'transparent'|'dark' };
  share_card_created:        { variant: string; mode: 'transparent'|'dark'; platform: string };
  // discover
  book_swiped:               { direction: 'left'|'right'|'up'; google_books_id: string };
  swipe_hint_shown:          {};
  // ai
  ai_recs_requested:         { mood: string; cached: boolean };
  ai_recs_shown:             { count: number };
  // notifications
  push_received:             { notif_type: string };
  push_opened:               { notif_type: string; deep_link: string };
  // monetization (Phase 4)
  paywall_shown:             { trigger: string };
  subscription_started:      { plan: string; trial: boolean };
};

export function track<E extends keyof AnalyticsEvents>(e: E, p: AnalyticsEvents[E]) {
  posthog.capture(e, p);
}
```

### 18.3 Server-side capture (cron / edge)

```pseudocode
function posthog_server(event, props, user_id):
  POST https://analytics.logos.app/capture/
    { api_key, event, distinct_id:user_id, properties: props ∪ {source:'server'} }
# used for: comeback_challenge_shown/_completed/_expired, streak_broken (cron), weekly_digest_sent
```

User properties kept current: `level_name` updated via `posthog.identify` on every level-up and app launch.

**Key funnels:** install → onboarding_completed → first session_completed (first-session-rate ≥80%); D1/D7/D30 via cohort on `session_completed`; share rate = `share_card_created` / `session_completed` (≥20%).

---

# SECTION 19 — DEEP LINK IMPLEMENTATION

**Depends on:** Expo Router + Expo Linking, Branch.io (deferred deep links), notification `data.deepLink`.

**Highest-risk decision:** Branch handles **deferred** deep links (link clicked → install → first open lands on target). Expo Linking handles **direct** `logos://` and universal links for already-installed users. Both resolve to the same Expo Router paths.

**Most common mistake:** mismatched scheme/path between notification payloads and the router tree → silent no-op. The table below is the contract.

### 19.1 Route table

| URL | Router path | Notes |
|---|---|---|
| `logos://home` | `/(tabs)/home` | default |
| `logos://library` | `/(tabs)/library` | |
| `logos://book/:id` | `/(tabs)/library/[userBookId]` | from share/social |
| `logos://session/:id` | `/session/[userBookId]` | **Live Activity tap target** |
| `logos://comeback` | `/(modals)/comeback` | comeback push |
| `logos://insights` | `/(tabs)/home/insights` | insight push |
| `logos://discover` | `/(tabs)/discover` | |
| `logos://stats` | `/(tabs)/stats` | |
| `logos://ai` | `/ai` | Phase 3 |
| `logos://scan` | `/(modals)/scanner` | |
| `logos://upgrade` | `/(modals)/paywall` | Phase 4 |
| `logos://share/:cardId` | `/(modals)/share-card?cardId=` | from Branch |
| `https://logos.app/book/:id` | universal link → `/library/[id]` | Branch + AASA/assetlinks |

### 19.2 Expo config

```json
// app.json
{ "expo": { "scheme": "logos",
  "ios": { "associatedDomains": ["applinks:logos.app", "applinks:logos.app.link"] },
  "android": { "intentFilters": [{ "action":"VIEW", "autoVerify":true,
     "data":[{ "scheme":"https", "host":"logos.app" }],
     "category":["BROWSABLE","DEFAULT"] }] } } }
```

### 19.3 Branch.io setup

- Init Branch in root layout; subscribe to `branch.subscribe(({params}) => router.push(mapBranchToRoute(params)))`.
- Share cards generate Branch links with `$deeplink_path` = `share/:cardId` and `$og_image_url` = uploaded card PNG (for rich previews).
- Deferred: a non-user who taps a friend's streak card → installs → first open routes to that card/book with `+clicked_branch_link`.

### 19.4 `logos://comeback` flow

Push `comeback_challenge_created` → `data.deepLink='logos://comeback'` → tap → `/(modals)/comeback` full modal → "Start Session" → `/session/[lastBook]`.

---

# SECTION 20 — ACCESSIBILITY IMPLEMENTATION

**Depends on:** every component (Section 4). Targets WCAG AA; Apple HIG + Material a11y.

**Highest-risk decision:** the **invisible-UI session timer** and gamified animations must remain operable for VoiceOver/TalkBack and Reduce Motion users — the timer auto-hide must not hide the Stop control from assistive tech.

**Most common mistake:** icon-only buttons (FAB, share, stop, scanner) with no `accessibilityLabel`; decorative Lottie/confetti not marked, stealing focus.

### 20.1 Labels (all 29 + 5)

| Component | accessibilityRole | accessibilityLabel (example) |
|---|---|---|
| StreakFlame | image | "Current streak: 12 days. At risk." |
| SessionTimer | timer | "Reading time 14 minutes 20 seconds" |
| SessionControlBar Stop | button | "Stop session" |
| PphCounter | text | "Reading speed 42 pages per hour" |
| BookCover | image | "Cover of {title} by {author}, {format}" |
| ProgressBar | progressbar | "{pct}% complete, page {n} of {total}" |
| FAB (start session) | button | "Start a reading session" |
| Scanner shutter | button | "Scan book barcode" |
| Share button | button | "Share your reading card" |
| RatingStars | adjustable | "Rating {n} of 5 stars" + increment/decrement actions |
| XpBar | progressbar | "Level {n}, {name}. {xp} of {next} XP" |
| BadgeTile | button | "{name} badge, {locked? 'locked, '+pct+'% complete' : 'unlocked'}" |
| SwipeCard | adjustable | "{title}. Swipe right to save, left to pass, up to super-like" + custom actions |
| Confetti / decorative Lottie | none | `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"` |
| ReadingInsightCard | summary | "Reading insight: {text}. Double-tap to share." |
| ComebackChallenge | progressbar | "Comeback: {k} of 3 sessions. {d} days left to restore {n}-day streak." |
| AlmostThereBanner | text | "{days} days to {badge} badge" |
| MilestoneCelebration | alert | "Milestone reached: {n}-day streak. You are a {levelName}." |
| LevelNameBadge | text | "Level: {levelName}" |

### 20.2 Reduce Motion

- `const reduceMotion = useReducedMotion();` (Reanimated) — gate all decorative motion.
- Confetti/flame pulse/celebration sequences → cross-fade or instant when enabled.
- Swipe physics retained (functional) but tilt/wiggle hints disabled.
- Skeleton shimmer → static dim block.

### 20.3 Dynamic Type

- All text via a scalable type system (no fixed `fontSize` on body without `allowFontScaling`).
- **Exception:** share-card canvas uses fixed sizes (it's an image, not UI) — but composer controls scale.
- Tabular figures for timers/stats to prevent reflow as size grows; verify no truncation at largest size on Library rows and bento tiles.

### 20.4 VoiceOver / TalkBack test cases

1. Start→stop a session entirely via screen reader; Stop reachable even after timer auto-hide.
2. Session-complete celebration announces stats; confetti not focusable.
3. ReadingInsightCard announced and shareable without sighted gesture.
4. ComebackChallenge progress announced on each increment (`AccessibilityInfo.announceForAccessibility`).
5. SwipeCard operable via custom actions (Save/Pass/Super-like) without swiping.
6. Streak at-risk state conveyed by text, not color alone (label says "at risk").
7. Largest Dynamic Type: Home bento, Library rows, Stats — no clipped text.
8. Reduce Motion on: no parallax/auto-animation; all info still reachable.

---

# SECTION 21 — LEGAL COMPLIANCE CHECKLIST

**Depends on:** account-deletion edge fn, export edge fn, age gate, privacy policy hosting.

**Highest-risk decision:** **account deletion must exist and be reachable in-app before App Store submission** (Apple guideline 5.1.1(v)). It must cascade-delete, cancel RevenueCat, and honor 30-day GDPR erasure.

**Most common mistake:** "delete account" that only signs out / soft-deletes. Apple rejects this; GDPR requires true erasure.

### 21.1 Checklist

| Item | Requirement | Implementation |
|---|---|---|
| Account deletion | in-app, reachable in ≤2 taps from Settings | `delete_account` edge fn: `auth.admin.deleteUser` → CASCADE removes all rows; cancel RevenueCat entitlement; PostHog `$delete`; confirm dialog + re-auth |
| GDPR erasure | complete within 30 days | immediate cascade; backups purged ≤30d `[VERIFY]` Supabase backup retention |
| Data export | JSON within 24h | `export_data` async job → Storage signed URL (24h expiry) emailed |
| Privacy Policy | live before beta | `logos.app/privacy` |
| Terms of Service | live before beta | `logos.app/terms` |
| Age gate | birth_year only (COPPA) | under-13 blocked screen; 13–17 `is_minor` → no social, no public reviews (RLS + trigger) |
| App Store age rating | 12+ | set in App Store Connect |
| COPPA | no data collection from under-13 | blocked at gate before any account creation |
| Data minimization | only what's needed | no precise location, no contacts |
| Live Activity disclosure | privacy policy section | "We display reading session info in the Dynamic Island / lock screen while a session is active." |
| Push consent | OS prompt at point of use | after first session (RULE 7) |
| RevenueCat (Phase 4) | restore purchases, clear pricing | required by Apple |

### 21.2 `delete_account` pseudocode

```pseudocode
function delete_account():
  uid = auth.uid()
  cancel_revenuecat(uid.rc_app_user_id)          # best-effort; log failures
  posthog_delete_person(uid)
  supabase.auth.admin.deleteUser(uid)            # CASCADE removes every owned row
  return { ok:true }
```

### 21.3 App Store review risks

- **Live Activity / foreground service** must be justified (active reading session) — disclose and stop promptly.
- **Gamification ≠ gambling**: no variable *monetary* rewards; insights are informational — safe.
- **Min-age / UGC**: reviews are UGC → need report/block (Phase 3 social) and minor restrictions (already enforced).
- **Background location**: none — avoid the entire category.

---

# SECTION 22 — PHASE-BY-PHASE SCOPING + RISK REGISTER

**Depends on:** all prior sections. **Meta-principle enforced:** gamification core (streak + grace + at-risk + Comeback Challenge + Variable Reward Insights) is **Phase 1 MUST-SHIP and never deferred** — it IS the product.

**Highest-risk decision:** protecting gamification from "ship core first" pressure. The scoping table below makes it contractual.

**Most common mistake:** treating Comeback Challenge / Variable Reward as Phase 2 polish. They are Phase 1.

### 22.1 Phase 1 (Months 1–3) — Beta. Team: 2 RN engs + 1 backend + 1 designer (PM shared).

| Feature | Status | Weeks | Depends on |
|---|---|---|---|
| Supabase schema + RLS + triggers | Must | 1.5 | — |
| Auth + age gate (COPPA) | Must | 1 | schema |
| Library (physical+ebook) + search | Must | 1.5 | schema, Google Books |
| Book scanner (ISBN) | Must | 1 | library |
| Session tracker (live + backdate, invisible UI) | Must | 2 | live_session_state |
| `complete_session` edge fn (atomic) | Must | 1.5 | schema |
| Streaks (UTC, grace, at-risk) | Must | 1.5 | complete_session |
| **Comeback Challenge** | Must | 1 | streaks |
| **Variable Reward Insights** | Must | 1.5 | sessions data |
| Session-end celebration (Duolingo moment) | Must | 1.5 | complete_session |
| Near-completion alerts | Must | 0.5 | streaks/badges |
| Basic Stats bento + heatmap | Must | 1 | sessions |
| Ratings/Reviews | Must | 1 | schema |
| Transparent PNG card v1 | Must | 1.5 | view-shot |
| iOS Dynamic Island + Android live notif (spike then build) | Must | 2.5 | tracker |
| Offline MMKV queue + sync | Must | 1.5 | complete_session |
| PostHog analytics | Must | 1 | — |
| Deep links v1 (no Branch yet) | Must | 0.5 | router |
| Account deletion + export | Must | 1 | schema |
| Push token registration (post-session) | Must | 0.5 | — |
| Badges full system | Deferred → P2 | — | — |
| XP visible levels UI | Deferred → P2 (logic in P1) | — | — |
| Swipe discovery | Deferred → P2 | — | — |
| Claude AI / Social / Audiobook | Deferred → P3 | — | — |

**Phase 1 build-order dependencies (explicit):** schema → `complete_session` → streaks → (comeback ∥ variable reward ∥ celebration) → cards/notifications. Live Activity spike runs parallel after tracker. **KPIs (beta exit):** D1 ≥ 60%, D7 ≥ 35%, first-session-rate ≥ 80%, crash-free ≥ 99.5%.

### 22.2 Phase 2 (Months 3–5) — Public launch. Team: same + 1 contract designer.

| Feature | Status | Weeks |
|---|---|---|
| Badges + "Almost There" states | Must | 1.5 |
| XP + Levels UI (identity labels everywhere) | Must | 1.5 |
| Book Swipe Discovery | Must | 2 |
| TBR list | Must | 0.5 |
| Challenges | Must | 1.5 |
| Push notifications (full templates + pg_cron) | Must | 2 |
| Speed calculator | Must | 0.5 |
| Enhanced stats | Must | 1 |
| All 4 share-card variants × 2 modes + level badge | Must | 2 |
| Escalating milestone celebrations (7/30/100/365) | Must | 1.5 |
| iOS Home Screen Widget | Must | 1.5 |
| Branch.io deep links | Must | 1 |

**KPIs (launch exit):** D30 ≥ 25%, share-card creation rate ≥ 20% of sessions.

### 22.3 Phase 3 (Months 5–8) — Team: +1 backend.

| Feature | Status | Weeks |
|---|---|---|
| Claude AI conversational recs | P3 | 2.5 |
| Social (follows, profiles, activity feed) | P3 | 4 |
| Audiobook format | P3 | 2 |
| Social-proof feed (friends' badges live, realtime) | P3 | 1.5 |

**KPIs:** D30 ≥ 20% sustained, viral coefficient (share→install) measurable > 0.15.

### 22.4 Phase 4 (Months 8–10) — Monetization + ASO.

| Feature | Status | Weeks |
|---|---|---|
| RevenueCat paywall (after-aha) | P4 | 2 |
| Streak Freeze tokens | P4 | 1 |
| ASO optimization | P4 | ongoing |

**ASO plan:** keywords — "reading tracker, book tracker, reading streak, reading timer, books read, reading stats, TBR." Title: "Logos — Reading Tracker & Streaks." Subtitle leads with session timer + streaks (vs Goodreads gap). Screenshots: session timer → streak flame → transparent share card → Dynamic Island → stats bento. App Preview video shows a live session + session-end celebration. Localize top 5 markets. A/B test icon (flame vs open book). Encourage ratings after a milestone celebration (not randomly).

### 22.5 Technical risk register (22 risks, each with implementable mitigation)

| # | Risk | Mitigation |
|---|---|---|
| 1 | `react-native-live-activities` unmaintained / breaks on SDK 51+ `[VERIFY]` | Time-boxed 1-wk spike Phase 1; if fail, build custom Expo native module (Option B). Budget +1.5wk reserved. |
| 2 | iOS throttles ActivityKit updates → stale timer | In-app UI-thread timer is fine clock; Activity updates coarse (30–60s/state change) only. |
| 3 | Android 14 foreground-service-type restrictions | Declare correct `foregroundServiceType`, stop service on session end, test on Android 14 device matrix. |
| 4 | Transparent PNG broken on Android | Default Dark on Android; Transparent "beta" via flattened (no-blur) capture path. |
| 5 | Streak double-increment across offline re-sync | `unique(user_id,client_uuid)` + dedup guard returns early before any side-effect. |
| 6 | Streak timezone bugs (UTC vs local) | Freeze `local_date` at capture; cron buckets by `timezone_offset_minutes`; recompute-from-history safety net. |
| 7 | `level_name` stale in push notifications | Render templates at send-time inside `send_push` reading live `users.level_name`. |
| 8 | Variable-reward data sparsity for new users | `eligible_insight_types` gates on min-data; empty set → no card (never generic). 60% boost only after data exists. |
| 9 | Same insight repeats / feels canned | Exclude types shown in last 7 days; seeded pick; ≥1 concrete number required. |
| 10 | Comeback challenge abuse (farm restores) | Only fires on break ≥3; one active per user (partial unique index); restore once; sessions must be ≥ min duration (anti-fraud floor). |
| 11 | `complete_session` non-atomic side effects | Single DB transaction wraps session+streak+xp+badge+insight+comeback; rollback on error. |
| 12 | Google Books API rate limits / gaps | Open Library fallback; cache `books` rows; backoff on 429. |
| 13 | Claude cost overrun | 7-day cache by prompt_hash; 5 fresh calls/user/day cap; genre fallback; spend alarm. |
| 14 | Claude returns malformed JSON | Zod validation; on throw → genre-based fallback recs. |
| 15 | PII / COPPA exposure for minors | Age gate before account; `is_minor` blocks social + public reviews via RLS + trigger. |
| 16 | Account-deletion incompleteness → App Store rejection | `delete_account` cascade + RevenueCat cancel + PostHog delete; QA verifies zero orphan rows. |
| 17 | MMKV queue overflow / data loss offline | Max 50 cap keeps most-recent; overflow toast; 8-retry then Sentry report (no silent drop). |
| 18 | Reanimated timer jank on low-end Android | UI-thread `useFrameCallback`/derived clock; no per-second setState; profile on low-end device. |
| 19 | Swipe deck jank / memory | Mount top 3 only; recycle; downscaled `expo-image`; no BlurView on cards. |
| 20 | pg_cron granularity / missed runs on Supabase `[VERIFY]` | Hourly jobs are idempotent; expiry sweep every 15m; jobs re-evaluate state, not deltas. |
| 21 | Push token churn (DeviceNotRegistered) | Null token on receipt error; re-register on launch; one token/user. |
| 22 | Notification quiet-hours / spam fatigue | `notification_settings` per-channel + quiet hours; defer sends into quiet window; cap 1 streak-nudge/day. |

---

*End of blueprint. All 22 sections complete. `[VERIFY]` tags flag every claim to confirm against live SDK/API docs before relying on it in production.*






