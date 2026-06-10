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

## Design system — NEUBRUTALISM (light-first)

**Light-first neubrutalism** (adopted 2026-06-08; supersedes the earlier dark-first "Quest", "Ember", and emerald passes). Off-white paper substrate, near-black ink, **flat reward-colour blocks**, **thick ink borders**, **SHARP 90° corners** (no rounding), and **HARD offset drop-shadows** (no blur). No gradients, no glass/blur, no soft shadows, no glow halos. The full scale lives in `theme/tokens.ts`.

- **Colors:** light `bg #F4F1E8` (warm paper) · `bgSec #FFFFFF` (white blocks) · `bgTer #ECE7DA` (inset cream) · `text/ink #141414` (also the border + hard-shadow colour). Flat reward blocks (shared light/dark): `accent/vermilion #FF3D1F` (actions, CTAs — aviation/hazard energy) · `ember/streak #FF8A1E` (amber flame — kept warm but distinct from the vermilion primary) · `gold #FFC53D` (XP/levels — black text on fill) · `level #E5327A` (magenta level-up). `onAccent #FFFFFF`. Each reward type owns a colour. `danger #B81414` deep crimson — deliberately a *different* red from the vermilion primary (never reuse accent for danger). A dark fallback theme exists (`bg #161616`, accent `#FF5436`) but light is primary/default.
- **Borders & shadows:** `BORDER_WIDTH 2` / `BORDER_WIDTH_THICK 3`, solid ink. Hard shadows via the RN `boxShadow` prop (New Arch), e.g. `SHADOW.card = '4px 4px 0px #141414'`; helper `hardShadow(color, offset)`. Cards/buttons "press into" their shadow. `RADIUS.*` are all `0` (`full: 9999` retained but unused).
- **Texture:** the substrate carries two tiled "analog degradation" overlays in `ScreenBackground` — a faint blueprint **crosshair grid** + fine **paper grain** (`assets/textures/grid.png` + `grain.png`, regenerate via `node scripts/gen-textures.js`). They're pure-alpha PNGs tiled with `resizeMode="repeat"`, recoloured per-theme via `tintColor` (ink on light, white on dark) at ~5–7% opacity. RN can't do the skill's SVG-filter/`mix-blend-mode` halftone or CRT scanlines (web-only) and scanlines clash with the light paper, so they're intentionally omitted.
- **Type:** **Space Grotesk** (display + UI + body; UPPERCASE for structural headers/labels) + **JetBrains Mono** (`FONTS.mono*` — all data, metadata, labels, numerics/telemetry: timers, stats, counters). `tabular-nums` on figures. The Cormorant serif + Inter were removed.
- **Theme:** default `light`; support light/dark/system per `users.theme`. A `ThemeTokens` object threads through every component (blueprint Section 4).

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

> **Sequencing note (decided 2026-06-08): email-first.** To stay in Expo Go as long as possible, B2 ships **email/password auth only** (signup folded into the final onboarding/profile step — "signup-last"). Native **Apple/Google sign-in is deferred to B5** alongside the dev build (push/Live Activity force it anyway). This validates the whole onboarding→library→sessions loop in Expo Go before any custom build.

- **B0 — Connect.  ✅ DONE.** `@supabase/supabase-js` installed, `lib/supabase.ts` (typed client + AsyncStorage persistence), `.env`/`.env.example`, `services/supabase/index.ts` compose-seam. Live Supabase project created; keys in `.env`.
- **B1 — Schema + RLS + triggers (blueprint §1).  ✅ DONE & DEPLOYED.** `supabase/migrations/20260604000000_init_schema.sql` (all tables/enums/indexes, RLS on every `public.*`, `level_name`+XP triggers, age-flag/minor-review triggers, `one_active_comeback_per_user`). Run against the live DB. **Pending YOU:** run the additive `20260608000000_add_genre_prefs.sql` (adds `users.genre_prefs`).
- **B2 — Email auth + age gate + onboarding write-through.  ✅ DONE (email).** ME: real `signIn/signUp/signOut` + `updateBirthYear/setGenrePrefs/setReadingGoal/updateProfile/completeOnboarding/getProfile` in `services/supabase/auth.ts`, composed into `liveApi` (mock fills the rest); session-aware boot redirect (`app/index.tsx`); real `(auth)/sign-in` screen; email+password capture + account-creation orchestration on the profile step; age-gate "Sign in" link. **Requires YOU:** turn OFF "Confirm email" in Supabase → Auth → Providers → Email (so signUp returns a session immediately; magic-link/confirmation returns with the dev build). Native Apple/Google buttons moved to B5.
- **B3 — Library, search, reviews.  ✅ DONE (code).** ME: `services/supabase/library.ts` — `getUserBooks/getUserBook/updateBookStatus/updateCurrentPage/removeBook` (owner-scoped RLS queries with `book:books(*)` embed; `removeBook` deletes the `user_books` row → DB cascades to `reading_sessions`, reviews survive via `user_book_id`→null, XP/streak untouched), `searchBooks/getRecommendedBooks` (client-side Google Books + Open Library fallback in `lib/bookSearch.ts`, no key), `addBook(book, format)` (takes the full search result — NO id re-fetch — → `ensure_book` edge fn → upserts `user_books`), `writeReview/getReviews` (RLS; reviewer names via a second `public_profiles` query since you can't embed a view). Composed as `libraryApi` into `liveApi`. Book-detail back button → library shelf; add-book shows a full-screen cover celebration + a real error banner (unwraps `FunctionsHttpError.context`). **Two notes:** (1) the half-star review UI is **rounded to whole stars** on persist — `reviews.rating` is `smallint(1–5)`; widen to `numeric(2,1)` later if halves must survive. (2) the book-detail **favorite heart is still local-only** — needs a new `setFavorite` LogosApi method (deferred micro-task). **Requires YOU:** `supabase functions deploy ensure_book`.
- **B4a — Gamification core (the heart): `complete_session` + streaks + XP + badges + insights.  ✅ DONE (code).** ME: `complete_session` implemented as an **atomic plpgsql RPC** (truer to "single transaction" than a Deno fn), idempotent on `(user_id, client_uuid)`, in `supabase/migrations/20260609000000_complete_session.sql` — session insert + book-progress + personal-best + streak (24h grace, `fn_apply_streak`) + XP (session/streak/pb/badge via the existing `fn_apply_xp` trigger) + badge unlock (`fn_eval_badges`, 11 seeded achievements) + comeback progress + variable-reward insight (`fn_generate_insight`, seeded 30%/60% gate, PAGE_MILESTONE/BEST_SESSION/BOOK_PACE) + milestone variant. Client `services/supabase/sessions.ts` = `completeSession` (RPC, called directly) + `getHomeData/getStats/getInsights/markInsightShared/getGoal/updateGoal` (owner-scoped reads, view-model assembly, level bounds mirror `fn_apply_xp`). Composed as `sessionApi` → `liveApi` (the whole `LogosApi` surface is now real). **Requires YOU:** run the migration. **B4a limitation:** without cron, comeback challenges are never *created* (the progress logic is in place but only fires on an active one) and `is_at_risk` stays false — both light up in B4b.
- **B4b — streak-lifecycle cron.  ✅ DONE (code).** `supabase/migrations/20260610000000_cron_streaks.sql` — `fn_evaluate_streaks` (break detection + comeback creation when broken ≥3), `fn_flag_at_risk` (18:00-local at-risk), `fn_expire_comebacks` (15-min expiry), all timezone-aware via `fn_local_now(offset)` + idempotent; self-schedules through pg_cron. No push fired (that's B5). No client change — `getHomeData` already reads `is_at_risk`/comeback. **Requires YOU:** enable pg_cron (Dashboard → Database → Extensions) then run the migration.
- **B4b — offline MMKV queue.  ⏸ DEFERRED to the dev-build transition (bundled with B5, decided 2026-06-09).** Wrap `completeSession` in an offline **MMKV queue** (`react-native-mmkv`) capturing sessions with a frozen `local_date`, draining through the RPC; the F5 error/retry states activate here. Needs the custom dev build, so it ships alongside B5's native work in one dev-build transition.
- **B5 — Native auth, push, deep links, share upload.** ME: native **Apple/Google sign-in** (`signInWithApple/Google`, `expo-apple-authentication` button + Google via `expo-auth-session`, social buttons on `(auth)/` screens — deferred here from B2); Expo push-token registration after first session; `send_push` edge fn + cron templates (§16); finalize `logos://` deep links (§19); upload share cards to Supabase Storage (public bucket); Branch optional later. YOU: Apple Developer (Sign in with Apple key + Service ID) + Google Cloud OAuth client IDs into Supabase → Auth → Providers; APNs key (iOS) + FCM (Android) into Expo + Supabase; create the Storage bucket.
- **B6 — Phase 3/4 services (after core ships).**
  - **AI recommendations (P3).  ✅ DONE (code).** `supabase/functions/ai_recommend/index.ts` — Deno edge fn, mood + `genre_prefs` + recent titles → Claude (`claude-sonnet-4-6`) via raw `fetch` with `output_config.format` JSON-schema (structured output); caches in `ai_rec_cache` 7 days keyed by sha256(mood+context+genres); Anthropic key is a Supabase secret only. Client `services/supabase/ai.ts` (`aiApi.aiRecommend` → `functions.invoke`, unwraps the real error from `FunctionsHttpError.context`) composed into `liveApi`; `aiRecommend(mood, context?)` added to `LogosApi` + mock. `app/ai/index.tsx` = single-shot mood-chips + freeform screen → 5 rec cards → tap routes to `add-book?q=<title author>` (new `q` param pre-seeds search). Entry: sparkles icon in the Library header. **Requires YOU:** `supabase secrets set ANTHROPIC_API_KEY=…` then `supabase functions deploy ai_recommend`. Model is one constant (swap to opus-4-8 / haiku-4-5).
  - **Account delete/export (P-launch).  ✅ DONE (code).** `delete_account` edge fn (service-role `auth.admin.deleteUser` → cascades the whole account) + client `exportData` (reads every owner-scoped table via RLS → JSON string, no edge fn) + `deleteAccount` (invoke + signOut), composed as `accountApi`. Settings → Account card gained **Export my data** (Share sheet) + **Delete account** (confirm Alert → sign-in). `LogosApi.exportData/deleteAccount` + mock. **Requires YOU:** `supabase functions deploy delete_account`.
  - **PostHog analytics.  ✅ DONE (code).** `posthog-react-native` (+ expo-file-system/application/device/localization) installed; `lib/analytics.ts` seam (init/identifyUser/track/resetAnalytics, **silent no-op if `EXPO_PUBLIC_POSTHOG_KEY` unset**). Root `_layout` inits + syncs `distinct_id` to the Supabase user via `onAuthStateChange` (identify on sign-in, reset on sign-out). Events: `onboarding_completed`, `session_completed` (format/pages/duration/PB/xp), `book_added` (source: search|session_picker|mood_reader), `mood_reader_used` (mode). **Requires YOU:** create a PostHog project, put `EXPO_PUBLIC_POSTHOG_KEY` (+ `EXPO_PUBLIC_POSTHOG_HOST`) in `.env`, restart Metro with `-c`.
  - **Monetization (P4) — dev build.** RevenueCat SDK + paywall, `users.rc_app_user_id` (native → with the B5 dev-build bundle).
  - YOU (remaining): RevenueCat account + products.

**Maps to blueprint §22:** B1–B5 ≈ Phase 1 (beta) core; B6 ≈ Phase 3/4. The §22 build order (schema → `complete_session` → streaks → comeback ‖ reward ‖ celebration → cards/notifications) is preserved by B1 → B4 → B5.

## app.json

- App name/slug are currently `LOGOS-APP-TEMP` — rename both `name` and `slug` to `Logos` (confirm the final slug before submission).
- Add `"scheme": "logos"` for deep links; set `"userInterfaceStyle": "automatic"` (design is dark-first but we support system/light).
- Add the Expo Router plugin in F0; add `associatedDomains` / Android `intentFilters` when deep links land (Section 19).
- Orientation stays locked to `portrait`.
