// ─────────────────────────────────────────────────────────────────────────────
// QuireApi — the stable interface that the UI binds to.
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
  NotificationSettings,
  QueuedSession,
  ReadingGoal,
  ReadingInsight,
  FeedbackKind,
  ReadingStatus,
  RestoreStreakResult,
  Review,
  StatsData,
  ThemePref,
  UserBook,
  UserProfile,
} from './types';

export interface QuireApi {
  // ── Auth ──────────────────────────────────────────────────────────────────
  signIn(email: string, password: string): Promise<{ userId: string }>;
  signUp(email: string, password: string, birthYear: number): Promise<{ userId: string }>;
  /**
   * Google OAuth. Resolves with the signed-in user, or throws `GOOGLE_CANCELLED`
   * if the reader backed out of the browser — callers should treat that as a
   * no-op, not an error worth showing.
   *
   * `birthYear` is what makes this COPPA-safe. Pass it from the onboarding funnel
   * and the `public.users` row is provisioned in the same call, exactly as signUp
   * does; omit it on the sign-in screen, where the row already exists. A new user
   * who arrives via sign-in simply lands with no profile row, and the boot
   * redirect routes them through the age gate before anything is written.
   *
   * Resumable like signUp: if a session already exists it skips the browser
   * entirely and just provisions, so a half-finished funnel can be completed.
   */
  signInWithGoogle(birthYear?: number): Promise<{ userId: string }>;
  signOut(): Promise<void>;
  /** Email a recovery code (works without deep links, unlike a reset link). */
  requestPasswordReset(email: string): Promise<void>;
  /** Verify the recovery code and set a new password (leaves the user signed in). */
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;

  // ── Onboarding ────────────────────────────────────────────────────────────
  updateBirthYear(birthYear: number): Promise<{ isMinor: boolean; isUnder13: boolean }>;
  setGenrePrefs(genres: string[]): Promise<void>;
  setReadingGoal(year: number, goalBooks: number): Promise<ReadingGoal>;
  updateProfile(data: { username?: string; displayName?: string; bio?: string | null; theme?: ThemePref; avatarUrl?: string | null }): Promise<UserProfile>;
  /** Upload a profile picture (base64 JPEG) to storage; returns its public URL. */
  uploadAvatar(base64: string): Promise<string>;
  completeOnboarding(): Promise<void>;

  // ── User ──────────────────────────────────────────────────────────────────
  getProfile(): Promise<UserProfile>;

  // ── Home ──────────────────────────────────────────────────────────────────
  getHomeData(): Promise<HomeData>;
  /** Spend one of the 5 lifetime restores to buy back the last broken streak.
   *  Server-authoritative and single-use — every eligibility rule (budget, the
   *  48h window, the 3-day floor) is re-checked in the RPC, so the client's copy
   *  of them is presentation only. Resolves with `ok: false` + a `reason` rather
   *  than throwing when the restore isn't allowed. */
  restoreStreak(): Promise<RestoreStreakResult>;

  // ── Library ───────────────────────────────────────────────────────────────
  getUserBooks(status?: ReadingStatus): Promise<UserBook[]>;
  getUserBook(userBookId: string): Promise<UserBook>;
  /** Add a searched book to the shelf. Pass the full search result (not just an
   *  id) so no second catalog round-trip is needed — the metadata is already in hand. */
  addBook(book: BookSearchResult, format: BookFormat): Promise<UserBook>;
  /** `page` is 0-based; omit it for the first page. */
  searchBooks(query: string, page?: number): Promise<BookSearchResult[]>;
  /** Curated suggestions shown in add-book before the user has typed anything. */
  getRecommendedBooks(): Promise<BookSearchResult[]>;
  /** NYT bestsellers for a list (e.g. 'hardcover-fiction'), ordered by rank.
   *  Served from a server-side cache refreshed weekly by cron — not a live call. */
  getBestsellers(list?: string): Promise<BookSearchResult[]>;
  /** `finishedAt` (ISO) backdates a finished book — for filling in books you read
   *  earlier so they land in the right month on stats. Ignored unless status='finished'. */
  updateBookStatus(userBookId: string, status: ReadingStatus, finishedAt?: string | null): Promise<UserBook>;
  updateCurrentPage(userBookId: string, page: number): Promise<void>;
  /** Remove a book from the shelf. Cascades to its reading_sessions (DB FK);
   *  reviews survive (their user_book_id is set null). Does NOT reverse XP/streak. */
  removeBook(userBookId: string): Promise<void>;
  /** Toggle the favorite (heart) flag on a shelf book. */
  setFavorite(userBookId: string, isFavorite: boolean): Promise<UserBook>;

  // ── Sessions ──────────────────────────────────────────────────────────────
  /** All post-session side effects (streak/XP/badges/insight/comeback) happen here.
   *  Never compute gamification math on the client — only call this. */
  completeSession(session: QueuedSession): Promise<CompleteSessionResult>;
  /** Delete a logged session from history and reverse only its direct effects —
   *  removes the row + its XP (recomputing level), leaving streak and earned
   *  badges intact. Quantitative totals update since they derive from the list.
   *  No-ops if the session is already gone. */
  deleteSession(sessionId: string): Promise<void>;

  // ── Reading goal ──────────────────────────────────────────────────────────
  getGoal(year: number): Promise<ReadingGoal | null>;
  updateGoal(year: number, goalBooks: number): Promise<ReadingGoal>;

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats(): Promise<StatsData>;

  // ── Insights ──────────────────────────────────────────────────────────────
  getInsights(): Promise<ReadingInsight[]>;
  markInsightShared(insightId: string): Promise<void>;

  // ── Reviews ───────────────────────────────────────────────────────────────
  /** Report a review as objectionable, and stop showing that reader's content.
   *  Required by Google Play's UGC policy for apps that display other users'
   *  writing. Reporting also blocks: the reporter must SEE the content go, not
   *  just be told a form was filed. Idempotent — re-reporting is a no-op. */
  reportReview(reviewId: string, authorId: string, reason: string): Promise<void>;
  writeReview(bookId: string, rating: number, body?: string, spoiler?: boolean): Promise<Review>;
  getReviews(bookId: string): Promise<Review[]>;
  /** The caller's own reviews (newest first), for the profile compilation. */
  getMyReviews(): Promise<Review[]>;

  // ── AI (B6) ─────────────────────────────────────────────────────────────────
  /** Mood/context → Claude book recommendations (server-side, cached 7 days). */
  aiRecommend(mood: string, context?: string): Promise<AiRecResult>;

  // ── Notifications (B5 / §16) ─────────────────────────────────────────────────
  /** The caller's notification preferences (auto-created on signup, defaults on). */
  getNotificationSettings(): Promise<NotificationSettings>;
  /** Patch any subset of notification preferences; returns the full updated row. */
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
  /** Store the device's Expo push token on the user row (for server-sent pushes). */
  registerPushToken(token: string): Promise<void>;

  // ── Account (B6 / §21) ───────────────────────────────────────────────────────
  /** Export all of the caller's data as a JSON string (GDPR portability). */
  exportData(): Promise<string>;
  /** Permanently delete the account + all data (cascade). Signs out after. */
  deleteAccount(): Promise<void>;

  // ── Feedback (test phase) ─────────────────────────────────────────────────────
  /** Store a tester's feedback / bug report in the DB for the owner to review.
   *  The impl attaches the app version + platform automatically. */
  submitFeedback(input: { kind: FeedbackKind; message: string }): Promise<void>;
}
