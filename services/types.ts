// ─────────────────────────────────────────────────────────────────────────────
// Quire shared types — mirrors the blueprint schema and edge-function contracts.
// Keep in sync with LOGOS_BLUEPRINT.md (Sections 1, 2, 4, 5, 6, 7, 9).
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type BookFormat = 'physical' | 'ebook' | 'audiobook';
/** 'want' = wishlist (don't own it yet); 'tbr' = own it, haven't started reading. */
export type ReadingStatus = 'want' | 'tbr' | 'reading' | 'finished' | 'dnf';
export type ThemePref = 'dark' | 'light' | 'system';
export type SubStatus = 'free' | 'trialing' | 'active' | 'expired' | 'grace';
export type SessionSource = 'live' | 'backdated' | 'offline_sync';
/** Tester feedback categories (stored in public.feedback during the test phase). */
export type FeedbackKind = 'bug' | 'feedback' | 'idea';
export type InsightType =
  | 'TIME_OF_DAY'
  | 'PACE_TREND'
  | 'GENRE_SPEED'
  | 'CONSISTENCY'
  | 'PAGE_MILESTONE'
  | 'BEST_SESSION'
  | 'BOOK_PACE';
export type AchievementKind =
  | 'streak'
  | 'volume'
  | 'consistency'
  | 'speed'
  | 'social'
  | 'milestone';
export type MilestoneVariant = 'normal' | 'bigger' | 'cinematic' | 'legendary';
export type CardVariant = 'session' | 'streak' | 'book_finished' | 'year_in_books';

// Level names (blueprint Section 5)
export type LevelName =
  | 'Page Turner'
  | 'Margin Scribbler'
  | 'Chapter Chaser'
  | 'Shelf Builder'
  | 'Spine Cracker'
  | 'Night Reader'
  | 'Bibliophile'
  | 'Tome Raider'
  | 'Literary Athlete'
  | 'Quire Legend';

// ── Domain models ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null; // from auth.users (not the public.users row)
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  genrePrefs: string[];
  birthYear: number;
  isMinor: boolean;
  isUnder13: boolean;
  theme: ThemePref;
  timezoneOffsetMinutes: number;
  timezoneName: string;
  totalXp: number;
  level: number;
  levelName: LevelName;
  /** Firefly balance — the reading currency. Optional so a build running
   *  against a pre-migration server reads undefined rather than throwing. */
  fireflies?: number;
  subscriptionStatus: SubStatus;
  onboardingCompletedAt: string | null;
  /** Moderator. Gates the review-report queue in Settings. */
  isAdmin: boolean;
}

export interface Book {
  id: string;
  googleBooksId: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  durationMinutes: number | null;
  publishedYear: number | null;
  genres: string[];
  description: string | null;
  // Catalog metadata (books table, blueprint Section 1). Optional so search
  // results and partial fixtures stay valid before the full row is hydrated.
  publisher?: string | null;
  isbn13?: string | null;
  language?: string;
}

export interface UserBook {
  id: string;
  userId: string;
  book: Book;
  format: BookFormat;
  status: ReadingStatus;
  currentPage: number;
  currentPositionMin: number;
  pageCountOverride: number | null;
  totalDurationMinutes: number | null;
  seriesName: string | null;
  seriesNumber: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  isFavorite: boolean;
}

export interface ReadingSession {
  id: string;
  userId: string;
  userBookId: string;
  bookId: string;
  format: BookFormat;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  startPage: number | null;
  endPage: number | null;
  pagesRead: number | null;
  minutesListened: number | null;
  pph: number | null;
  source: SessionSource;
  localDate: string;
  xpAwarded: number;
  isPersonalBest: boolean;
}

// Offline MMKV queue item (blueprint Section 8)
export interface QueuedSession {
  clientUuid: string;
  userBookId: string;
  bookId: string;
  format: BookFormat;
  startedAt: string;
  endedAt: string;
  startPage: number | null;
  endPage: number | null;
  minutesListened: number | null;
  endPositionMin: number | null;
  localDate: string;
  source: SessionSource;
  enqueuedAt: number;
  attempts: number;
}

/** How long after a break a streak can still be bought back. Mirrors the same
 *  window in `restore_streak` — the server is the authority, this is only so the
 *  UI can hide an offer the server would reject. */
export const RESTORE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** A break below this many days isn't worth spending a restore on. Mirrors
 *  `restore_streak`. */
export const RESTORE_MIN_STREAK = 3;

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastReadLocalDate: string | null;
  isAtRisk: boolean;
  /** Lifetime restore budget — 5 granted at signup, never refills. Maps to
   *  `streaks.freeze_tokens`, which predates this feature. */
  restoresLeft: number;
  /** The last break, only while it's still restorable. Null once restored, once
   *  the 48h window closes, or if the streak was too short to be worth it. */
  brokenStreak: {
    /** Days lost — what the overlay offers to buy back. */
    value: number;
    brokenAt: string;
    /** brokenAt + RESTORE_WINDOW_MS, precomputed for countdown copy. */
    expiresAt: string;
  } | null;
}

export interface RestoreStreakResult {
  ok: boolean;
  /** Present on success. */
  currentStreak?: number;
  restoresLeft?: number;
  /** True when a session already logged today stacked on top of the restore. */
  countedToday?: boolean;
  /** Present on failure: nothing_to_restore | no_restores | window_closed |
   *  streak_too_short | no_streak. */
  reason?: string;
}

export interface ComebackChallenge {
  id: string;
  streakAtBreak: number;
  sessionsCompleted: 0 | 1 | 2 | 3;
  startedAt: string;
  expiresAt: string;
  completedAt: string | null;
  expiredAt: string | null;
  streakRestored: boolean;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: AchievementKind;
  iconName: string;
  lottieKey: string | null;
  unlockThreshold: number;
  almostThereThreshold: number;
  xpReward: number;
  unlockedAt: string | null;
  progressValue: number;
}

export interface ReadingInsight {
  id: string;
  sessionId: string | null;
  insightType: InsightType;
  insightText: string;
  dataSnapshot: Record<string, unknown>;
  shownAt: string;
  wasShared: boolean;
}

export interface NotificationSettings {
  enabled: boolean;            // master switch
  dailyReminder: boolean;
  dailyReminderHour: number;   // 0–23, local
  atRiskAlerts: boolean;
  weeklyDigest: boolean;
  comebackAlerts: boolean;
  socialAlerts: boolean;
  insightAlerts: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

export interface ReadingGoal {
  id: string;
  userId: string;
  year: number;
  goalBooks: number;
  goalPages: number | null;
}

/** A flagged review, as the moderation queue shows it. */
export interface ReviewReport {
  id: string;
  reviewId: string;
  reason: string;
  createdAt: string;
  reporterName: string | null;
  /** Null once the underlying review has already been deleted. */
  review: {
    body: string | null;
    rating: number;
    authorId: string;
    authorName: string | null;
    bookTitle: string | null;
  } | null;
}

export interface Review {
  id: string;
  userId: string;
  bookId: string;
  rating: number;
  body: string | null;
  containsSpoilers: boolean;
  isPublic: boolean;
  createdAt: string;
  // Denormalised author display (joined from profiles server-side). Optional so
  // the write path — which returns the row before the join — stays valid.
  userName?: string | null;
  userAvatarUrl?: string | null;
}

// ── complete_session result (blueprint Section 2) ─────────────────────────────

export interface CompleteSessionResult {
  ok: boolean;
  deduped: boolean;
  sessionId: string;
  pagesRead: number | null;
  pph: number | null;
  durationSeconds: number;
  isPersonalBest: boolean;
  streak: {
    current: number;
    incremented: boolean;
    restoredViaGrace: boolean;
  };
  xpGained: number;
  /** Fireflies this session earned, and the balance after banking them.
   *  Optional on purpose: a client running against a server that predates the
   *  fireflies migration gets undefined rather than throwing, so a stale build
   *  degrades to "no fireflies shown" instead of a broken session-complete. */
  firefliesEarned?: number;
  firefliesTotal?: number;
  // Post-XP level standing (server-authoritative; derived client-side on live
  // without a schema change). `leveledUp` is true when this session pushed the
  // reader across a level boundary — the trigger for the level-up celebration.
  level: number;
  levelName: LevelName;
  leveledUp: boolean;
  newBadges: Badge[];
  comeback: {
    status: 'progress' | 'completed' | 'expired' | null;
    sessionsCompleted?: number;
    daysRemaining?: number;
    restoredTo?: number;
  } | null;
  insight: ReadingInsight | null;
  milestoneVariant: MilestoneVariant | null;
}

// ── Screen-level view models ──────────────────────────────────────────────────

export interface HomeData {
  user: Pick<UserProfile, 'id' | 'displayName' | 'avatarUrl' | 'levelName' | 'level' | 'totalXp' | 'fireflies'>;
  streak: StreakState;
  activeBook: UserBook | null;
  comeback: ComebackChallenge | null;
  almostThere: {
    kind: 'streak_milestone' | 'badge';
    label: string;
    progress: number;
    daysRemaining?: number;
    badgeSlug?: string;
  } | null;
  goal: ReadingGoal | null;
  recentSessions: ReadingSession[];
  xpToNextLevel: number;
  prevLevelXp: number;
}

export interface StatsData {
  lifetimePages: number;
  lifetimeHours: number;
  booksFinished: number;
  avgPph: number | null;
  currentStreak: number;
  longestStreak: number;
  heatmapDays: { date: string; minutes: number }[];
  badges: Badge[];
  sessions: ReadingSession[];
}

export interface BookSearchResult {
  googleBooksId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  durationMinutes: number | null;
  publishedYear: number | null;
  genres: string[];
  description: string | null;
  // ISBN-13 when the provider supplies it. Carried so addBook can enrich thin
  // records from Open Library (page count / description / subjects) before the
  // catalog upsert. Optional — Open-Library-only results often lack it.
  isbn13?: string | null;
}

// ── Author profile (Open Library) ────────────────────────────────────────────
// Public catalog data for the author page. Google Books has no author entity at
// all, so this comes entirely from Open Library — and OL coverage is VERY uneven:
// a well-known novelist has a bio, photo, links and ratings, while a mid-list
// author may have nothing but a name and a work count. EVERY field except `name`
// is therefore optional by design, and the author screen must read as deliberate
// when most of them are null.
export interface AuthorProfile {
  name: string;                  // canonical OL spelling (may differ in case from the query)
  openLibraryId: string | null;
  photoUrl: string | null;
  bio: string | null;            // markdown stripped, reference-link junk removed
  /** Attribution pulled out of the bio's trailing "Source: …" line (CC BY-SA). */
  bioSource: { title: string; url: string } | null;
  birthDate: string | null;      // free-form, e.g. "20 February 1991"
  deathDate: string | null;
  workCount: number | null;
  topWork: string | null;        // OL's most-held work — "best known for"
  subjects: string[];            // top_subjects, cleaned + de-duplicated
  ratingAverage: number | null;  // 0–5, null when nobody has rated them
  ratingCount: number;
  readerCount: number;           // readinglog_count — people tracking them on OL
  links: { title: string; url: string }[];
}

// ── AI recommendations (B6 / blueprint §17) ──────────────────────────────────
export interface AiBookRec {
  title: string;
  author: string;
  why: string; // one concise sentence on why it fits the reader
}

export interface AiRecResult {
  recs: AiBookRec[];
  cached: boolean; // served from the 7-day ai_rec_cache vs a fresh Claude call
}

// ── Curios (the collection fireflies buy) ─────────────────────────────────────

/** One curio on the shelf. `key` stays a plain string here so services/ does not
 *  depend on components/; components/curio/curios.ts narrows it for rendering. */
export interface OwnedCurio {
  key: string;
  count: number;
  firstFoundAt: string;
}

/** Outcome of opening one pouch. The server decides all of it. */
export type PouchResult =
  /** `error` is a request that never reached a verdict — offline, timeout, a
   *  server fault. Distinct from `insufficient` because telling someone with
   *  200 fireflies that they cannot afford 40 is both wrong and alarming. */
  | { ok: false; reason: 'insufficient' | 'error'; cost: number }
  | {
      ok: true;
      key: string;
      /** True when you already had it — `refunded` fireflies come back. */
      duplicate: boolean;
      /** How many of this curio you now own. */
      count: number;
      refunded: number;
      /** Balance after the spend (and the refund, if any). */
      fireflies: number;
    };
