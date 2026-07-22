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
  subscriptionStatus: SubStatus;
  onboardingCompletedAt: string | null;
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

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastReadLocalDate: string | null;
  isAtRisk: boolean;
  freezeTokens: number;
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
  user: Pick<UserProfile, 'id' | 'displayName' | 'avatarUrl' | 'levelName' | 'level' | 'totalXp'>;
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
