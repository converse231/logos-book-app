# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**LOGOS** — a gamified reading-tracker mobile app. The emotional north star is making readers feel like *literary athletes*: "In the beginning was the Word. Track every one you read." Streaks, comeback challenges, variable-reward reading insights, and XP/levels are not features bolted onto a tracker — **gamification IS the product**.

React Native + Expo (managed, **SDK 54**), file-based routing via **Expo Router**, written in **TypeScript**. Entry point today is `index.js` → `App.js` (default scaffold); phase **F0** migrates the app to the Expo Router `app/` tree.

> **`LOGOS_BLUEPRINT.md` is the single source of truth.** It is the authoritative 22-section product + technical spec. This file is the working guide; when the two conflict on product or architecture, the blueprint wins. The blueprint marks unverified claims with `[VERIFY]` — confirm those against live SDK/API docs before relying on them.

## Status & approach

**Frontend-first.** We build and refine the entire UI/UX against a typed **mock service layer**, then integrate the Supabase backend later. The repo is still the default Expo scaffold — there is no `app/` tree, no TypeScript, and none of the runtime stack installed yet. Phase **F0** (below) establishes the foundation; everything after it is UI work backed by mock data.

### Critical rule — gamification stays server-authoritative (even while mocked)

The blueprint's single most important architectural rule: **all post-session side effects** (streak, XP, badges, insights, comeback, personal-best) live in **one transactional edge function `complete_session`**, idempotent on `client_uuid`. A naive client that mutates streaks/XP after `insert session` is non-atomic, cheatable, and drifts `level_name`.

**Never compute streak / XP / celebration math inside components.** During the frontend phase we honor this rule by routing everything through a `LogosApi` interface (see *Data layer*) whose **mock implementation** returns realistic results. When the backend lands, the real Supabase implementation drops in with **zero UI changes** — no client-side gamification logic to throw away.

## Commands

```bash
npm start          # Start Expo dev server (scan QR with Expo Go)
npm run android    # Start with Android emulator
npm run ios        # Start with iOS simulator (macOS only)
npm run web        # Start in browser
```

## Stack

Installed today: `expo`, `expo-asset`, `expo-status-bar` only. Items marked *(to add)* arrive in F0+.

- React 19.1.0 · React Native 0.81.5 · Expo SDK 54 (managed)
- **Expo Router** — file-based `app/` tree *(to add)*
- **TypeScript** *(to add)*
- **Reanimated 3** — all animation on the UI thread; never the legacy `Animated` API *(to add)*
- **Zustand + MMKV** — state + offline session queue *(to add)*
- `@gorhom/bottom-sheet`, `expo-image`, `react-native-gesture-handler`, `react-native-view-shot`, Lottie *(to add as each feature lands)*
- Backend (later): **Supabase** (Postgres / Auth / Storage / Realtime / Edge Functions / pg_cron)
- Analytics: **PostHog** (self-hosted) · AI: **Claude API** `claude-sonnet-4-20250514` (Phase 3) · Monetization: **RevenueCat** (Phase 4)
- No testing libraries installed yet.

### Expo SDK version (load-bearing constraint)

Expo SDK is **54**. Always consult the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo-specific code — APIs change between SDK versions.

**iOS Expo Go only supports the single latest SDK.** The App Store Expo Go currently ships SDK 54, so this project must stay on SDK 54 to run on a physical iPhone via Expo Go. Do not downgrade. When Apple ships a newer Expo Go, upgrade with `npm install expo@^<new> && npx expo install --fix`.

## Front-end architecture rules

These are the non-negotiable client rules distilled from the blueprint (Sections 2/3/4/8/9/20):

- **Reanimated 3, on the UI thread.** Drive the session timer and PPH counter with a shared clock + `useDerivedValue` / `useFrameCallback` — **never** `setState` / `setInterval` (causes dropped frames and full re-renders).
- **The session tracker is a root `Stack` route _above_ the tabs** — not a modal, not inside the tab navigator. This lets the Live Activity / Dynamic Island deep-link straight into it and keeps the tab bar from stealing the bottom thumb zone reserved for session controls. Celebrations are `transparentModal` overlays composited on top of the tracker.
- **`level_name` is identity everywhere** (share cards, notifications, alerts). It is denormalized and trigger-maintained server-side; the client only ever **reads** it. Surface it through `LevelNameBadge`.
- **Format-aware data.** Audiobooks share the `reading_sessions` shape but with `pages_read NULL` and `minutes_listened NOT NULL`. Guard every PPH / page aggregate against `format === 'audiobook'` (COALESCE / filter) — otherwise NaN/Infinity in averages.
- **Offline-first sessions.** Sessions are captured into an MMKV queue with a **frozen `local_date`** and a `client_uuid`; sync drains the queue through the idempotent `complete_session`. Compute `local_date` at capture time, never at sync time.
- **Accessibility from the start.** Every icon-only control (FAB, Stop, share, scanner) needs an `accessibilityLabel`; gate all decorative motion behind `useReducedMotion()`; the invisible-UI Stop control must stay reachable for screen readers even after the timer auto-hides.
- **Backdrop policy — no glass blur.** Modals, sheets (`SheetScaffold`), and celebration overlays dim the screen behind them with a **darkened translucent rgba scrim** (≈ `rgba(3,4,6,0.62)` dark / `rgba(17,19,24,0.4)` light), never a `BlurView`/frosted-glass. `expo-blur` is intentionally not a dependency (consistent cross-platform, cheaper on Android). The `SessionControlBar`'s near-opaque `t.glass` fill is a solid translucent surface, not a blur.

## App structure (Expo Router target — blueprint Section 3)

```
app/
├── _layout.tsx                 Root Stack + providers (Auth, Zustand, Theme, PostHog)
├── index.tsx                   Boot redirect → onboarding | (tabs)/home
├── (auth)/                     sign-in, sign-up
├── (onboarding)/               age-gate → welcome → genres → goal → profile
├── (tabs)/                     home (+ insights) · library (+ detail, tbr) · discover (P2) · stats · profile (+ settings)
├── session/[userBookId].tsx    ROOT STACK, full-screen tracker (above tabs) + backdate.tsx
├── (modals)/                   session-complete · milestone/[variant] · reading-insight · comeback ·
│                               share-card · add-book · scanner · review · filter-sort · goal-edit · paywall (P4)
└── ai/                         conversational recs (P3)
```

Deep-link scheme is `logos://` (full route table → blueprint Section 19).

## Design system (provisional — refine during design)

Dark-first, **"Quest"** brand — a gamified, arcade-energy reward palette (chosen 2026-06-04; the earlier cool-emerald and a warm "Ember" pass were both rejected). The full scale lives in `theme/tokens.ts`.

- **Colors (Quest):** `bg #0E0F14` (near-black) · `bgSec #181B22` · `bgTer #252A34` · `accent/electric-blue #3D7BFF` (CTAs, active) · `ember/streak #FF6B4A` (coral flame) · `gold #FFC53D` (XP/levels) · `level #FF4D8D` (magenta level-up/celebration) · `text #F4F6FB` · `textSec #A7AEBE`. Multi-accent reward system (action/streak/XP/level each own a color). `onAccent #FFFFFF` (white text on vivid fills). Light mode is clean cool off-white (`bg #F7F9FC`, accent `#2563EB` for AA). `danger #E5484D` stays clearly red, distinct from the coral streak.
- **Type:** a literary display face (**Cormorant Garamond / Cinzel**) for identity surfaces — level-name reveals, Year-in-Books — over the system sans (SF Pro / Roboto) + **Inter** for cross-platform numerics with **tabular figures** (timers, stats).
- **Theme:** default `dark`; support light/system per `users.theme`. A `ThemeTokens` object threads through every component (blueprint Section 4).

## Component library (blueprint Section 4)

34 components: 29 core (AppShell, BentoGrid, StreakFlame, SessionTimer, SessionControlBar, PphCounter, BookCover, ProgressBar, …, ShareCardCanvas, AiChatBubble) + 5 new (ReadingInsightCard, ComebackChallenge, AlmostThereBanner, MilestoneCelebration, LevelNameBadge). **Build against the TypeScript prop interfaces in the blueprint — do not redesign the contracts.**

## Data layer (frontend phase)

- `services/types.ts` — shared types from the blueprint (`QueuedSession`, `CompleteSessionResult`, `ThemeTokens`, `LevelName`, `BookFormat`, view models).
- `services/api.ts` — the `LogosApi` interface mirroring the edge-function contracts (`completeSession`, `getHome`, `ensureBook`, `aiRecommend`, …).
- `services/mock/` — fixture-backed implementation returning realistic gamification results.
- Screens/components consume the interface via a provider/hook. The Supabase implementation later replaces the mock with no UI changes.

## Frontend-first roadmap

Ordering reflects the confirmed "onboarding first" decision. (Product Phase 1–4 scoping, KPIs, and the 22-risk register live in blueprint **Section 22**; the gamification core — streak + grace + at-risk + Comeback Challenge + Variable Reward — is Phase-1 must-ship and is **never deferred**.)

- **F0 — Foundation:** migrate to TypeScript + Expo Router; install Reanimated 3 / Zustand / MMKV / gesture-handler / bottom-sheet / expo-image; theme tokens + providers; nav shell (tabs + root stack); mock service layer + fixtures; fix `app.json`.
- **F1 — Onboarding (first vertical):** age-gate (COPPA under-13 block, 13–17 minor flag) → welcome (animated mock stat card) → genres (mirror-back) → goal (`useReadingProjection`, Section 13) → profile/theme → home handoff; includes `GoalProjectionCard`.
- **F2 — Core reading loop:** Home bento (StreakFlame + banners) → Session Tracker (invisible-UI timer) → session-end celebration → Reading Insight card → share-card composer.
- **F3 — Library & detail:** Library shelf + bottom-anchored search, add-book sheet, book detail, reviews, scanner UI.
- **F4 — Gamification surfaces & stats:** comeback widget/modal, almost-there banner, escalating milestone celebrations (7/30/100/365), Stats bento + heatmap, XP/levels UI, badges.
- **F5 — Polish:** empty / error / skeleton states (Section 12), accessibility pass (Section 20), reduced-motion, Dynamic Island / Android live-notification spike.
- **Backend integration:** swap the mock `LogosApi` for Supabase, phased B0–B6 — see the next section.

## Backend integration roadmap (B-phases)

> Runs **after** the frontend phases (F0–F5, complete). The whole app is built against the typed **`LogosApi`** interface (`services/api.ts`) with a mock implementation (`services/mock/`). Integration = stand up Supabase and drop in a real `LogosApi` **method-group by method-group**, flipping `services/ApiContext.tsx` from `mockApi` to the Supabase impl. **No UI changes required** — that is the entire point of the seam.

**Carried-over non-negotiable:** all post-session gamification (streak / XP / badges / insight / comeback / personal-best) stays inside one transactional `complete_session` edge function, idempotent on `client_uuid`. The mock already returns this exact contract, so the swap is faithful. Never move that math to the client.

**Auth decision (confirmed 2026-06-04): Sign in with Apple + Google + email** (magic-link or password fallback). Apple is required by App Store Guideline 4.8 once Google is offered. **Social sign-in does NOT skip the COPPA age gate** — every *new* account (social or email) runs the age-gate to capture `birth_year` before the `public.users` row is created (under-13 → blocked; 13–17 → `is_minor`, which RLS + triggers use to block public reviews and social). `public.users.id references auth.users(id)` 1:1 (blueprint §1). The `LogosApi` will gain `signInWithApple()` / `signInWithGoogle()` alongside the existing email methods.

**Legend — who does what:** **YOU** = external setup only an account owner can do (create projects, copy keys, configure the Apple/Google OAuth consoles, run/deploy via CLI). **ME** = every line of in-repo code (client, SQL migrations, edge functions, the real `LogosApi`).

**Secrets policy:** the client bundle gets ONLY `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (safe — RLS-protected). The **service-role key** and **Anthropic API key** live ONLY as Supabase edge-function secrets, never in the app or git. `.env` stays gitignored; commit a `.env.example`.

**Dev-build line:** the app runs in **Expo Go through F5**. Integration crosses into native modules that need a **custom dev build**: Apple/Google native auth, `react-native-mmkv` (offline queue), push, Live Activity, and `react-native-view-shot` (already flagged). **Create the dev build at B2** (first native-auth module); after that, test on a dev build / real device, not Expo Go.

- **B0 — Connect (no behavior change).** YOU: create the Supabase project + copy `SUPABASE_URL` and `anon` key; pick PostHog Cloud vs self-hosted (Cloud is faster; can switch later). ME: `expo install @supabase/supabase-js`; `lib/supabase.ts` (typed client + AsyncStorage session persistence); `.env` + `.env.example` + `app.config.ts` exposing the two public vars; scaffold `services/supabase/index.ts` (real `LogosApi`, methods throwing "not implemented" until filled). App still runs on `mockApi`.
- **B1 — Schema + RLS + triggers (blueprint §1).** ME: author migrations for every table / enum / index, the RLS policies (§1), `level_name`+XP triggers, generated `is_minor`/`is_under_13` columns, and the `one_active_comeback_per_user` partial unique index. YOU: run them — link the Supabase CLI and `supabase db push` (recommended; migrations live in repo) or paste the SQL in the dashboard; confirm RLS is ON for every `public.*` table.
- **B2 — Auth + age gate + onboarding write-through.  ← dev build starts here.** YOU: Apple Developer → Sign in with Apple key + Service ID; Google Cloud → OAuth client IDs (iOS/Android/web); paste into Supabase → Auth → Providers; set redirect URLs + `logos://` scheme. ME: real `signIn/signUp/signOut` + `signInWithApple/Google` via Supabase Auth (`expo-apple-authentication` native button + Google via `expo-auth-session`); wire `(auth)/` screens + social buttons; boot redirect (`app/index.tsx`) reads session → onboarding (no users row) or home; age-gate + `updateBirthYear/setGenrePrefs/updateProfile/completeOnboarding/getProfile` hit Supabase. Auth + profile go real; the rest stays mock.
- **B3 — Library, search, reviews (direct RLS queries + `ensure_book`).** ME: real `getUserBooks/getUserBook/addBook/updateBookStatus/updateCurrentPage/searchBooks/getRecommendedBooks/writeReview/getReviews` as owner-scoped queries; Google Books search client-side + Open Library fallback (no key); `ensure_book` edge fn for catalog upserts (service role); wire the book-detail favorite heart (currently local-only) to a real write. YOU: `supabase functions deploy ensure_book`.
- **B4 — Gamification core (the heart): `complete_session` + streaks + comeback + insights.** ME: `complete_session` (atomic, idempotent on `client_uuid`) per blueprint §2.2; pg_cron `fn_evaluate_streaks`, at-risk @18:00 local (UTC-bucketed by `timezone_offset_minutes`), comeback-expiry (§2.3); offline **MMKV queue** (`react-native-mmkv`) capturing sessions with a frozen `local_date` and draining through `complete_session`; real `completeSession/getHomeData/getStats/getInsights/markInsightShared/getGoal/updateGoal`. The F5 error/retry states activate for real here. YOU: deploy the edge fns + schedule the pg_cron jobs (SQL I provide).
- **B5 — Push, deep links, share upload.** ME: Expo push-token registration after first session; `send_push` edge fn + cron templates (§16); finalize `logos://` deep links (§19); upload share cards to Supabase Storage (public bucket); Branch optional later. YOU: APNs key (iOS) + FCM (Android) into Expo + Supabase; create the Storage bucket.
- **B6 — Phase 3/4 services (after core ships).** AI (P3): `ai_recommend` edge fn (Anthropic key as Supabase secret, strict-schema validate, cache by `prompt_hash` 7 days, §17) + `ai/` chat. Monetization (P4): RevenueCat SDK + paywall, `users.rc_app_user_id`. Analytics: PostHog client + server events (`distinct_id = user_id`, §18). Account: `delete_account` + `export_data` edge fns (§21). YOU: Anthropic key (Supabase secret), RevenueCat account + products, PostHog project.

**Maps to blueprint §22:** B1–B5 ≈ Phase 1 (beta) core; B6 ≈ Phase 3/4. The §22 build order (schema → `complete_session` → streaks → comeback ‖ reward ‖ celebration → cards/notifications) is preserved by B1 → B4 → B5.

## app.json

- App name/slug are currently `LOGOS-APP-TEMP` — rename both `name` and `slug` to `Logos` (confirm the final slug before submission).
- Add `"scheme": "logos"` for deep links; set `"userInterfaceStyle": "automatic"` (design is dark-first but we support system/light).
- Add the Expo Router plugin in F0; add `associatedDomains` / Android `intentFilters` when deep links land (Section 19).
- Orientation stays locked to `portrait`.
