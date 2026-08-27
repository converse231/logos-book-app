// ─────────────────────────────────────────────────────────────────────────────
// Mock QuireApi implementation.
// Returns realistic fixture data; gamification side-effects are simulated to
// match the complete_session contract (blueprint Section 2).
// ─────────────────────────────────────────────────────────────────────────────

import { QuireApi } from '../api';
import {
  Book,
  BookFormat,
  BookSearchResult,
  CompleteSessionResult,
  CurioSetId,
  HomeData,
  LevelName,
  NotificationSettings,
  QueuedSession,
  ReadingGoal,
  ReadingInsight,
  ReadingStatus,
  Review,
  StatsData,
  ThemePref,
  UserBook,
  UserProfile,
} from '../types';
import {
  MOCK_BOOKS,
  MOCK_HOME_DATA,
  MOCK_INSIGHT,
  MOCK_READING_GOAL,
  MOCK_RECOMMENDED,
  MOCK_REVIEWS,
  MOCK_SEARCH_CATALOG,
  MOCK_SESSIONS,
  MOCK_STATS,
  MOCK_USER,
  MOCK_USER_BOOK,
  MOCK_USER_BOOKS,
} from './fixtures';

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms));

// Ordered level ladder (blueprint §5) — for the mock's demo level-up.
const LEVEL_LADDER: LevelName[] = [
  'Page Turner', 'Margin Scribbler', 'Chapter Chaser', 'Shelf Builder', 'Spine Cracker',
  'Night Reader', 'Bibliophile', 'Tome Raider', 'Literary Athlete', 'Quire Legend',
];
const nextLevelName = (cur: LevelName): LevelName =>
  LEVEL_LADDER[Math.min(LEVEL_LADDER.indexOf(cur) + 1, LEVEL_LADDER.length - 1)];

/** Same arithmetic as complete_session's v_fire, kept in step deliberately:
 *  3 base, +1 per 10 pages, +1 per 10 minutes, capped at 25. */
function mockFireflies(pages: number | null, durationSeconds: number): number {
  return Math.min(25, 3 + Math.floor((pages ?? 0) / 10) + Math.floor(durationSeconds / 600));
}

let _user: UserProfile = { ...MOCK_USER };

let _notifSettings: NotificationSettings = {
  enabled: true,
  dailyReminder: true,
  dailyReminderHour: 20,
  atRiskAlerts: true,
  weeklyDigest: true,
  comebackAlerts: true,
  socialAlerts: true,
  insightAlerts: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

// Mutable mock state for the curio shelf — module-level so a pouch opened on one
// screen is still there when another reads it, the way the server would behave.
// Per set, mirroring open_pouch(p_set) — a pouch is bought for one shelf.
const MOCK_CURIO_KEYS: Record<CurioSetId, string[]> = {
  found: [
    'acorn', 'acorn-gold', 'berries', 'clover', 'egg', 'feather', 'lantern',
    'leaf', 'moonflower', 'mushroom', 'pebble', 'pinecone', 'snail',
  ],
  lit: [
    'lit-boot', 'lit-bow', 'lit-goldfish', 'lit-harpoon', 'lit-horseshoe',
    'lit-notebook', 'lit-paintbox', 'lit-portrait', 'lit-silk-shirt',
    'lit-soma', 'lit-spectacles',
  ],
};
const mockCurios: { key: string; count: number; firstFoundAt: string }[] = [];
let mockFireflyBalance = 128;

export const mockApi: QuireApi = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async signIn(_email, _password) {
    await delay();
    return { userId: _user.id };
  },

  async signUp(_email, _password) {
    await delay();
    return { userId: _user.id };
  },

  async signInWithGoogle() {
    await delay(600); // the browser round-trip is the slowest part of the real one
    return { userId: _user.id };
  },

  async getAuthEmail() {
    return null; // the mock funnel is always the email path
  },

  async hasProfile() {
    await delay(100);
    return _user.onboardingCompletedAt != null;
  },

  async signOut() {
    await delay(100);
  },

  async requestPasswordReset(_email) {
    await delay();
  },

  async resetPassword(_email, _code, _newPassword) {
    await delay();
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  async updateBirthYear(birthYear) {
    await delay();
    const age = new Date().getFullYear() - birthYear;
    _user = { ..._user, birthYear, isMinor: age < 18, isUnder13: age < 13 };
    return { isMinor: _user.isMinor, isUnder13: _user.isUnder13 };
  },

  async updateProfile(data) {
    await delay();
    _user = {
      ..._user,
      username: data.username ?? _user.username,
      displayName: data.displayName ?? _user.displayName,
      bio: data.bio !== undefined ? data.bio : _user.bio,
      theme: (data.theme as ThemePref) ?? _user.theme,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : _user.avatarUrl,
    };
    return { ..._user };
  },

  async uploadAvatar(base64: string) {
    await delay(400);
    return `data:image/jpeg;base64,${base64}`; // in-memory preview for the mock
  },

  async completeOnboarding(data) {
    await delay(300);
    const age = new Date().getFullYear() - data.birthYear;
    if (age < 13) throw new Error('Quire is for readers 13 and up.');
    _user = {
      ..._user,
      birthYear: data.birthYear,
      isMinor: age < 18,
      isUnder13: false,
      displayName: data.displayName,
      genrePrefs: data.genres,
      theme: (data.theme as ThemePref) ?? _user.theme,
      avatarUrl: data.avatarUrl ?? _user.avatarUrl,
      onboardingCompletedAt: new Date().toISOString(),
    };
    return { ..._user };
  },

  // ── User ────────────────────────────────────────────────────────────────
  async getProfile() {
    await delay(150);
    return { ..._user };
  },

  // ── Home ────────────────────────────────────────────────────────────────
  async getHomeData() {
    await delay(300);
    return { ...MOCK_HOME_DATA } as HomeData;
  },

  async restoreStreak() {
    await delay(400);
    const broken = MOCK_HOME_DATA.streak.brokenStreak;
    if (!broken) return { ok: false, reason: 'nothing_to_restore' };
    if (MOCK_HOME_DATA.streak.restoresLeft <= 0) return { ok: false, reason: 'no_restores' };
    // Mutating the fixture keeps the mock honest across a re-fetch: the overlay
    // won't offer the same restore twice, same as the real single-use RPC.
    MOCK_HOME_DATA.streak.restoresLeft -= 1;
    MOCK_HOME_DATA.streak.currentStreak = broken.value;
    MOCK_HOME_DATA.streak.brokenStreak = null;
    return {
      ok: true,
      currentStreak: broken.value,
      restoresLeft: MOCK_HOME_DATA.streak.restoresLeft,
      countedToday: false,
    };
  },

  // ── Library ─────────────────────────────────────────────────────────────
  async getUserBooks(status?: ReadingStatus) {
    await delay();
    const books = status ? MOCK_USER_BOOKS.filter((b) => b.status === status) : MOCK_USER_BOOKS;
    return books.map((b) => ({ ...b }));
  },

  async getUserBook(userBookId: string) {
    await delay();
    const found = MOCK_USER_BOOKS.find((b) => b.id === userBookId) ?? MOCK_USER_BOOK;
    return { ...found };
  },

  async addBook(searchResult: BookSearchResult, format: BookFormat) {
    await delay(400);
    // Prefer a known catalog book (richer fixture); otherwise synthesize one from
    // the search result so any added book lands on the shelf.
    const book: Book =
      MOCK_BOOKS.find((b) => b.googleBooksId === searchResult.googleBooksId) ?? {
        id: 'book-' + searchResult.googleBooksId,
        googleBooksId: searchResult.googleBooksId,
        title: searchResult.title,
        subtitle: null,
        authors: searchResult.authors,
        coverUrl: searchResult.coverUrl,
        pageCount: searchResult.pageCount,
        durationMinutes: searchResult.durationMinutes,
        publishedYear: searchResult.publishedYear,
        genres: searchResult.genres,
        description: searchResult.description,
        publisher: null,
        isbn13: null,
        language: 'en',
      };
    // Already on the shelf — return the existing row instead of duplicating it.
    const existing = MOCK_USER_BOOKS.find((b) => b.book.id === book.id);
    if (existing) return { ...existing };
    const userBook: UserBook = {
      id: 'user-book-' + Date.now(),
      userId: _user.id,
      book,
      format,
      status: 'want',
      currentPage: 0,
      currentPositionMin: 0,
      pageCountOverride: null,
      totalDurationMinutes: format === 'audiobook' ? book.durationMinutes : null,
      seriesName: null,
      seriesNumber: null,
      startedAt: null,
      finishedAt: null,
      isFavorite: false,
    };
    MOCK_USER_BOOKS.unshift(userBook); // in-session persistence so the shelf updates
    return { ...userBook };
  },

  async searchBooks(query: string) {
    await delay(500);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_SEARCH_CATALOG.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.some((a) => a.toLowerCase().includes(q))
    );
  },

  async getRecommendedBooks() {
    await delay(250);
    return MOCK_RECOMMENDED.map((b) => ({ ...b }));
  },

  async getBestsellers(_list?: string) {
    await delay(250);
    // Reuse the catalog as a stand-in "bestseller" list for the frontend phase.
    return MOCK_RECOMMENDED.slice(0, 10).map((b) => ({ ...b }));
  },

  async updateBookStatus(userBookId: string, status: ReadingStatus, finishedAt?: string | null) {
    await delay();
    const found = MOCK_USER_BOOKS.find((b) => b.id === userBookId) ?? MOCK_USER_BOOK;
    const updated = {
      ...found,
      status,
      finishedAt: status === 'finished' ? (finishedAt ?? new Date().toISOString()) : found.finishedAt,
    } as UserBook;
    const i = MOCK_USER_BOOKS.findIndex((b) => b.id === userBookId);
    if (i >= 0) MOCK_USER_BOOKS[i] = updated; // in-session persistence
    return updated;
  },

  async updateCurrentPage(_userBookId: string, _page: number) {
    await delay(100);
  },

  async removeBook(userBookId: string) {
    await delay(200);
    const i = MOCK_USER_BOOKS.findIndex((b) => b.id === userBookId);
    if (i >= 0) MOCK_USER_BOOKS.splice(i, 1); // in-session removal so the shelf updates
  },

  async setFavorite(userBookId: string, isFavorite: boolean) {
    await delay(150);
    const found = MOCK_USER_BOOKS.find((b) => b.id === userBookId) ?? MOCK_USER_BOOK;
    const updated = { ...found, isFavorite } as UserBook;
    const i = MOCK_USER_BOOKS.findIndex((b) => b.id === userBookId);
    if (i >= 0) MOCK_USER_BOOKS[i] = updated; // in-session persistence
    return updated;
  },

  // ── Sessions ────────────────────────────────────────────────────────────
  // This mirrors the complete_session edge-function contract.
  // ALL gamification results come from here — never computed by the caller.
  async completeSession(session: QueuedSession): Promise<CompleteSessionResult> {
    await delay(800);
    const pagesRead =
      session.format !== 'audiobook' && session.startPage != null && session.endPage != null
        ? session.endPage - session.startPage
        : null;
    const durationSeconds = Math.round(
      (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
    );
    const pph = pagesRead != null && durationSeconds > 0
      ? Math.round((pagesRead / (durationSeconds / 3600)) * 10) / 10
      : null;

    // Demo: occasionally land on a streak milestone so the escalating celebration
    // is reachable in the frontend phase. The streak count is set to the
    // milestone so the celebration reads true. Backend will compute this for real.
    const milestones = [
      { count: 7, variant: 'normal' as const },
      { count: 30, variant: 'bigger' as const },
      { count: 100, variant: 'cinematic' as const },
      { count: 365, variant: 'legendary' as const },
    ];
    const hit = Math.random() < 0.3 ? milestones[Math.floor(Math.random() * milestones.length)] : null;
    const streakCurrent = hit ? hit.count : 13;
    // Demo: occasionally cross a level boundary so the level-up celebration is
    // reachable in the frontend phase (mutually exclusive with a milestone).
    const leveledUp = !hit && _user.level < LEVEL_LADDER.length && Math.random() < 0.25;

    return {
      ok: true,
      deduped: false,
      sessionId: 'mock-session-' + Date.now(),
      pagesRead,
      pph,
      durationSeconds,
      isPersonalBest: false,
      streak: { current: streakCurrent, incremented: true, restoredViaGrace: false },
      xpGained: leveledUp ? 340 : 72,
      // Mirrors the server formula exactly (3 base, +1/10 pages, +1/10 min,
      // capped at 25) so mock mode paces the same as live.
      firefliesEarned: mockFireflies(pagesRead, durationSeconds),
      firefliesTotal: (_user.fireflies ?? 0) + mockFireflies(pagesRead, durationSeconds),
      level: leveledUp ? _user.level + 1 : _user.level,
      levelName: leveledUp ? nextLevelName(_user.levelName) : _user.levelName,
      leveledUp,
      newBadges: [],
      comeback: null,
      // The milestone / level-up is the bigger reward — don't stack an insight on it.
      insight: !hit && !leveledUp && Math.random() < 0.3 ? { ...MOCK_INSIGHT, id: 'insight-' + Date.now() } : null,
      milestoneVariant: hit ? hit.variant : null,
    };
  },

  async deleteSession(_sessionId: string): Promise<void> {
    // Mock history isn't persisted, so there's nothing to remove — the real impl
    // deletes the row + reverses its XP server-side.
    await delay(400);
  },

  // ── Reading goal ─────────────────────────────────────────────────────────
  async getGoal(_year: number) {
    await delay();
    return { ...MOCK_READING_GOAL };
  },

  async updateGoal(year: number, goalBooks: number) {
    await delay();
    return { ...MOCK_READING_GOAL, year, goalBooks } as ReadingGoal;
  },

  // ── Stats ────────────────────────────────────────────────────────────────
  async getStats() {
    await delay(400);
    return { ...MOCK_STATS } as StatsData;
  },

  // ── Insights ─────────────────────────────────────────────────────────────
  async getInsights() {
    await delay();
    return [{ ...MOCK_INSIGHT }] as ReadingInsight[];
  },

  async markInsightShared(_insightId: string) {
    await delay(100);
  },

  // ── Reviews ──────────────────────────────────────────────────────────────
  async reportReview(_reviewId, _authorId, _reason) {
    await delay();
  },

  async getReviewReports() {
    await delay();
    return [];
  },

  async resolveReport(_reportId, _action) {
    await delay();
  },

  async writeReview(bookId: string, rating: number, body?: string, spoiler = false) {
    await delay(300);
    const review: Review = {
      id: 'review-' + Date.now(),
      userId: _user.id,
      bookId,
      rating,
      body: body ?? null,
      containsSpoilers: spoiler,
      isPublic: !_user.isMinor,
      createdAt: new Date().toISOString(),
      userName: _user.displayName,
      userAvatarUrl: _user.avatarUrl,
    };
    // Persist in-session so the detail screen shows it on the next focus refetch,
    // replacing any earlier review by this user for the same book.
    const existing = (MOCK_REVIEWS[bookId] ?? []).filter((r) => r.userId !== _user.id);
    MOCK_REVIEWS[bookId] = [review, ...existing];

    // Goodreads-style: rating/reviewing a book marks it finished.
    const i = MOCK_USER_BOOKS.findIndex((b) => b.book.id === bookId);
    if (i >= 0 && MOCK_USER_BOOKS[i].status !== 'finished') {
      MOCK_USER_BOOKS[i] = { ...MOCK_USER_BOOKS[i], status: 'finished', finishedAt: new Date().toISOString() };
    }

    return review;
  },

  async getReviews(bookId: string) {
    await delay();
    return (MOCK_REVIEWS[bookId] ?? []).map((r) => ({ ...r }));
  },

  async getMyReviews() {
    await delay();
    return Object.values(MOCK_REVIEWS)
      .flat()
      .filter((r) => r.userId === _user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({ ...r }));
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  async getNotificationSettings() {
    await delay(120);
    return { ..._notifSettings };
  },

  async updateNotificationSettings(patch) {
    await delay(150);
    _notifSettings = { ..._notifSettings, ...patch };
    return { ..._notifSettings };
  },

  async registerPushToken(_token: string) {
    await delay(100); // no-op in mock
  },

  // ── Account ────────────────────────────────────────────────────────────────
  async exportData() {
    await delay(400);
    return JSON.stringify({ exportedAt: new Date().toISOString(), user: _user, note: 'mock export' }, null, 2);
  },

  async deleteAccount() {
    await delay(300);
  },

  // ── Curios ────────────────────────────────────────────────────────────────
  async getCurios() {
    return mockCurios.map((c) => ({ ...c }));
  },

  async openPouch(set: CurioSetId) {
    if (mockFireflyBalance < 40) {
      return { ok: false as const, reason: 'insufficient' as const, cost: 40 };
    }
    mockFireflyBalance -= 40;
    const pool = MOCK_CURIO_KEYS[set] ?? MOCK_CURIO_KEYS.found;
    // Mirrors the RPC's weighting (20260826000000): weight falls off with the
    // copies already held, 3 / (1 + 2*count). Same Efraimidis-Spirakis draw, so
    // mock mode paces like live instead of teaching the wrong feel.
    const held = new Map(mockCurios.map((c) => [c.key, c.count]));
    let key = pool[0];
    let best = -1;
    for (const k of pool) {
      const w = 3 / (1 + 2 * (held.get(k) ?? 0));
      const score = Math.pow(Math.random(), 1 / w);
      if (score > best) {
        best = score;
        key = k;
      }
    }
    const hit = mockCurios.find((c) => c.key === key);
    const duplicate = !!hit;
    if (hit) hit.count += 1;
    else mockCurios.push({ key, count: 1, firstFoundAt: new Date().toISOString() });
    if (duplicate) mockFireflyBalance += 12;
    return {
      ok: true as const,
      key,
      duplicate,
      count: hit ? hit.count : 1,
      refunded: duplicate ? 12 : 0,
      fireflies: mockFireflyBalance,
    };
  },

  async submitFeedback(_input: { kind: string; message: string }) {
    // Mock: accept and discard — the real impl writes to public.feedback.
    await delay(500);
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  async aiRecommend(mood: string, _context?: string) {
    await delay(900);
    const m = mood.toLowerCase();
    return {
      recs: [
        { title: 'Project Hail Mary', author: 'Andy Weir', why: `A ${m || 'gripping'} ride — propulsive problem-solving with real heart.` },
        { title: 'Piranesi', author: 'Susanna Clarke', why: 'Quietly mind-bending; a haunting world that unfolds one room at a time.' },
        { title: 'The Long Way to a Small, Angry Planet', author: 'Becky Chambers', why: 'Cozy, character-first sci-fi for when you want warmth over stakes.' },
        { title: 'Recursion', author: 'Blake Crouch', why: 'Fast, twisty, and impossible to put down once it grabs you.' },
        { title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', why: 'A tender story about making things together and growing up.' },
      ],
      cached: false,
    };
  },
};
