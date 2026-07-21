# Quire

> In the beginning was the Word. Track every one you read.

A gamified reading tracker built to make readers feel like **literary athletes**. Streaks, comeback challenges, variable-reward insights, and XP/levels aren't bolted onto a book tracker — gamification *is* the product.

## Tech stack

- **React Native + Expo** (managed, SDK 54) · **Expo Router** (file-based routing) · **TypeScript**
- **Reanimated 3** for all animation (UI thread, no legacy `Animated` API)
- **Zustand** for client state · **AsyncStorage**-backed offline session queue
- **Supabase** — Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron
- **PostHog** for analytics · **Claude API** for AI reading recommendations

Design language: light-first neubrutalism — flat reward-color blocks, thick ink borders, sharp corners, hard offset shadows. No gradients, no glass/blur.

## Getting started

**Prerequisites:** Node 18+, the [Expo Go](https://expo.dev/go) app on your phone (or an iOS/Android simulator).

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL/anon key (see below)
npm start              # scan the QR code with Expo Go
```

Other run targets:

```bash
npm run android   # Android emulator
npm run ios       # iOS simulator (macOS only)
npm run web       # browser
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Only `EXPO_PUBLIC_*` variables are safe to ship in the client bundle (the Supabase anon key is RLS-protected). Service-role keys and third-party API secrets live only as Supabase Edge Function secrets — never in `.env` or the client.

## Project structure

```
app/                 Expo Router file-based routes
├── (auth)/           sign-in
├── (onboarding)/     age-gate → welcome → genres → goal → profile
├── (tabs)/           home · library · discover · stats · profile
├── session/          full-screen reading tracker + history
├── (modals)/         session-complete, milestones, share cards, add-book, ...
└── ai/               conversational book recommendations

components/          Shared UI components
services/            QuireApi interface + mock and Supabase implementations
stores/              Zustand stores (session, library, app state)
theme/               Design tokens (color, type, spacing, shadow)
lib/                 Small platform helpers (notifications, live activity, ...)
supabase/
├── migrations/       SQL schema, RLS policies, and RPC functions
└── functions/        Edge Functions (Deno)
```

## Backend

The app talks to Supabase through a single typed `QuireApi` interface (`services/api.ts`), so the UI never depends on Supabase directly. All post-session gamification math (streaks, XP, badges, comeback challenges) runs server-side in one atomic `complete_session` RPC — never computed on the client.

To stand up your own backend: create a Supabase project, then run the SQL files in `supabase/migrations/` in filename order, and deploy the functions in `supabase/functions/` with `supabase functions deploy <name>`.

## Status

Frontend-first: the UI is built and refined against a typed mock service layer before wiring up the real backend. See `CLAUDE.md` for the detailed build log and phase breakdown, and `LOGOS_BLUEPRINT.md` for the full product/technical spec.
