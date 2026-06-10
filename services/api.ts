// ─────────────────────────────────────────────────────────────────────────────
// LogosApi — the stable interface that the UI binds to.
// Mock implementation lives in services/mock/.
// Supabase implementation will replace the mock with no UI changes.
// React provider + useApi hook live in services/ApiContext.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import {
  AiRecResult,
  BookFormat,
  BookSearchResult,
  CompleteSessionResult,
  HomeData,
  QueuedSession,
  ReadingGoal,
  ReadingInsight,
  ReadingStatus,
  Review,
  StatsData,
  ThemePref,
  UserBook,
  UserProfile,
} from './types';

export interface LogosApi {
  // ── Auth ──────────────────────────────────────────────────────────────────
  signIn(email: string, password: string): Promise<{ userId: string }>;
  signUp(email: string, password: string, birthYear: number): Promise<{ userId: string }>;
  signOut(): Promise<void>;

  // ── Onboarding ────────────────────────────────────────────────────────────
  updateBirthYear(birthYear: number): Promise<{ isMinor: boolean; isUnder13: boolean }>;
  setGenrePrefs(genres: string[]): Promise<void>;
  setReadingGoal(year: number, goalBooks: number): Promise<ReadingGoal>;
  updateProfile(data: { username?: string; displayName?: string; theme?: ThemePref }): Promise<UserProfile>;
  completeOnboarding(): Promise<void>;

  // ── User ──────────────────────────────────────────────────────────────────
  getProfile(): Promise<UserProfile>;

  // ── Home ──────────────────────────────────────────────────────────────────
  getHomeData(): Promise<HomeData>;

  // ── Library ───────────────────────────────────────────────────────────────
  getUserBooks(status?: ReadingStatus): Promise<UserBook[]>;
  getUserBook(userBookId: string): Promise<UserBook>;
  /** Add a searched book to the shelf. Pass the full search result (not just an
   *  id) so no second catalog round-trip is needed — the metadata is already in hand. */
  addBook(book: BookSearchResult, format: BookFormat): Promise<UserBook>;
  searchBooks(query: string): Promise<BookSearchResult[]>;
  /** Curated suggestions shown in add-book before the user has typed anything. */
  getRecommendedBooks(): Promise<BookSearchResult[]>;
  updateBookStatus(userBookId: string, status: ReadingStatus): Promise<UserBook>;
  updateCurrentPage(userBookId: string, page: number): Promise<void>;
  /** Remove a book from the shelf. Cascades to its reading_sessions (DB FK);
   *  reviews survive (their user_book_id is set null). Does NOT reverse XP/streak. */
  removeBook(userBookId: string): Promise<void>;

  // ── Sessions ──────────────────────────────────────────────────────────────
  /** All post-session side effects (streak/XP/badges/insight/comeback) happen here.
   *  Never compute gamification math on the client — only call this. */
  completeSession(session: QueuedSession): Promise<CompleteSessionResult>;

  // ── Reading goal ──────────────────────────────────────────────────────────
  getGoal(year: number): Promise<ReadingGoal | null>;
  updateGoal(year: number, goalBooks: number): Promise<ReadingGoal>;

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats(): Promise<StatsData>;

  // ── Insights ──────────────────────────────────────────────────────────────
  getInsights(): Promise<ReadingInsight[]>;
  markInsightShared(insightId: string): Promise<void>;

  // ── Reviews ───────────────────────────────────────────────────────────────
  writeReview(bookId: string, rating: number, body?: string, spoiler?: boolean): Promise<Review>;
  getReviews(bookId: string): Promise<Review[]>;

  // ── AI (B6) ─────────────────────────────────────────────────────────────────
  /** Mood/context → Claude book recommendations (server-side, cached 7 days). */
  aiRecommend(mood: string, context?: string): Promise<AiRecResult>;

  // ── Account (B6 / §21) ───────────────────────────────────────────────────────
  /** Export all of the caller's data as a JSON string (GDPR portability). */
  exportData(): Promise<string>;
  /** Permanently delete the account + all data (cascade). Signs out after. */
  deleteAccount(): Promise<void>;
}
