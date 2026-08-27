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
  ReviewReport,
  StatsData,
  ThemePref,
  UserBook,
  UserProfile,
  CurioSetId,
  OwnedCurio,
  PouchResult,
} from './types';

export interface QuireApi {
  // ── Auth ──────────────────────────────────────────────────────────────────
  signIn(email: string, password: string): Promise<{ userId: string }>;
  /**
   * Creates the auth user only. The `public.users` row is NOT written here —
   * `completeOnboarding` is the single door for that (COPPA is enforced inside
   * it, server-side). Throws `EMAIL_IN_USE` when the address already has an
   * account and the supplied password doesn't open it.
   */
  signUp(email: string, password: string): Promise<{ userId: string }>;
  /**
   * Google OAuth. Resolves with the signed-in user, or throws `GOOGLE_CANCELLED`
   * if the reader backed out of the browser — callers should treat that as a
   * no-op, not an error worth showing.
   *
   * Authenticates only — it never writes `public.users`. A Google user who has
   * not finished the funnel simply has no profile row, which is exactly the
   * state the boot redirect uses to route them back into onboarding. COPPA is
   * enforced in `completeOnboarding`, the only thing that can create a row.
   */
  signInWithGoogle(): Promise<{ userId: string }>;
  /** True when a `public.users` row exists for the current session — i.e. the
   *  reader has actually been provisioned, not just authenticated. */
  hasProfile(): Promise<boolean>;
  /** The signed-in account's email, or null when signed out. Unlike getProfile
   *  this needs no public.users row — which is exactly the state a Google user is
   *  in partway through onboarding. */
  getAuthEmail(): Promise<string | null>;
  signOut(): Promise<void>;
  /** Email a recovery code (works without deep links, unlike a reset link). */
  requestPasswordReset(email: string): Promise<void>;
  /** Verify the recovery code and set a new password (leaves the user signed in). */
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;

  // ── Onboarding ────────────────────────────────────────────────────────────
  updateBirthYear(birthYear: number): Promise<{ isMinor: boolean; isUnder13: boolean }>;
  updateProfile(data: { username?: string; displayName?: string; bio?: string | null; theme?: ThemePref; avatarUrl?: string | null }): Promise<UserProfile>;
  /** Upload a profile picture (base64 JPEG) to storage; returns its public URL. */
  uploadAvatar(base64: string): Promise<string>;
  /**
   * Finishes the funnel in ONE transaction: creates/updates `public.users`
   * (identity + genres + timezone + the completion stamp) and the year's
   * reading goal together, or not at all. Replaces the old four-call flush,
   * which could half-succeed and strand a reader on an empty account.
   *
   * Enforces the COPPA age check server-side — under-13 is rejected here
   * regardless of what the client sends. Idempotent: safe to retry, and it
   * never moves the original completion timestamp.
   */
  completeOnboarding(data: {
    birthYear: number;
    displayName: string;
    genres: string[];
    goalBooks: number;
    theme?: ThemePref;
    avatarUrl?: string | null;
  }): Promise<UserProfile>;

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
  /** Open reports, newest first. Admin-only — RLS returns nothing for everyone
   *  else, so there's no separate permission check to keep in sync. */
  getReviewReports(): Promise<ReviewReport[]>;
  /** Resolve a report. 'removed' deletes the review; 'dismissed' leaves it up.
   *  Either way the report leaves the queue. */
  resolveReport(reportId: string, action: 'removed' | 'dismissed'): Promise<void>;
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

  // ── Curios (the collection) ──────────────────────────────────────────────────
  /** Everything the caller has found so far. Owner-scoped; empty until a pouch. */
  getCurios(): Promise<OwnedCurio[]>;
  /** Spend fireflies on one pouch from `set`. Atomic and server-rolled — spend,
   *  roll, grant and duplicate-refund all happen in a single transaction, so the
   *  client can neither choose its prize nor overdraw by tapping twice. The set
   *  only narrows WHICH keys are in the hat; the roll itself is still the
   *  server's. */
  openPouch(set: CurioSetId): Promise<PouchResult>;

  // ── Feedback (test phase) ─────────────────────────────────────────────────────
  /** Store a tester's feedback / bug report in the DB for the owner to review.
   *  The impl attaches the app version + platform automatically. */
  submitFeedback(input: { kind: FeedbackKind; message: string }): Promise<void>;
}
