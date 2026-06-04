// ─────────────────────────────────────────────────────────────────────────────
// Supabase implementation of LogosApi.
// Built out method-group by method-group across the B-phases (see CLAUDE.md
// "Backend integration roadmap"). Until a method is implemented it throws, so a
// premature provider flip fails loudly instead of silently returning undefined.
// The mock (services/mock) stays the active provider until each group is ready.
// ─────────────────────────────────────────────────────────────────────────────

import { LogosApi } from '../api';
// import { supabase } from '@/lib/supabase'; // wired in as methods are implemented

function notImpl(name: string): never {
  throw new Error(
    `[supabase] ${name}() is not implemented yet — it lands in a later B-phase (see CLAUDE.md backend roadmap).`
  );
}

export const supabaseApi: LogosApi = {
  // ── Auth (B2) ──────────────────────────────────────────────────────────────
  signIn: async () => notImpl('signIn'),
  signUp: async () => notImpl('signUp'),
  signOut: async () => notImpl('signOut'),

  // ── Onboarding (B2) ─────────────────────────────────────────────────────────
  updateBirthYear: async () => notImpl('updateBirthYear'),
  setGenrePrefs: async () => notImpl('setGenrePrefs'),
  setReadingGoal: async () => notImpl('setReadingGoal'),
  updateProfile: async () => notImpl('updateProfile'),
  completeOnboarding: async () => notImpl('completeOnboarding'),

  // ── User (B2) ────────────────────────────────────────────────────────────────
  getProfile: async () => notImpl('getProfile'),

  // ── Home (B4) ────────────────────────────────────────────────────────────────
  getHomeData: async () => notImpl('getHomeData'),

  // ── Library (B3) ─────────────────────────────────────────────────────────────
  getUserBooks: async () => notImpl('getUserBooks'),
  getUserBook: async () => notImpl('getUserBook'),
  addBook: async () => notImpl('addBook'),
  searchBooks: async () => notImpl('searchBooks'),
  getRecommendedBooks: async () => notImpl('getRecommendedBooks'),
  updateBookStatus: async () => notImpl('updateBookStatus'),
  updateCurrentPage: async () => notImpl('updateCurrentPage'),

  // ── Sessions (B4) ────────────────────────────────────────────────────────────
  completeSession: async () => notImpl('completeSession'),

  // ── Reading goal (B4) ────────────────────────────────────────────────────────
  getGoal: async () => notImpl('getGoal'),
  updateGoal: async () => notImpl('updateGoal'),

  // ── Stats (B4) ───────────────────────────────────────────────────────────────
  getStats: async () => notImpl('getStats'),

  // ── Insights (B4) ────────────────────────────────────────────────────────────
  getInsights: async () => notImpl('getInsights'),
  markInsightShared: async () => notImpl('markInsightShared'),

  // ── Reviews (B3) ─────────────────────────────────────────────────────────────
  writeReview: async () => notImpl('writeReview'),
  getReviews: async () => notImpl('getReviews'),
};
