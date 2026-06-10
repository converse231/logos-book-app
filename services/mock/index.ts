// ─────────────────────────────────────────────────────────────────────────────
// Mock LogosApi implementation.
// Returns realistic fixture data; gamification side-effects are simulated to
// match the complete_session contract (blueprint Section 2).
// ─────────────────────────────────────────────────────────────────────────────

import { LogosApi } from '../api';
import {
  Book,
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

let _user: UserProfile = { ...MOCK_USER };

export const mockApi: LogosApi = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async signIn(_email, _password) {
    await delay();
    return { userId: _user.id };
  },

  async signUp(_email, _password, birthYear) {
    await delay();
    const age = new Date().getFullYear() - birthYear;
    _user = { ..._user, birthYear, isMinor: age < 18, isUnder13: age < 13 };
    return { userId: _user.id };
  },

  async signOut() {
    await delay(100);
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  async updateBirthYear(birthYear) {
    await delay();
    const age = new Date().getFullYear() - birthYear;
    _user = { ..._user, birthYear, isMinor: age < 18, isUnder13: age < 13 };
    return { isMinor: _user.isMinor, isUnder13: _user.isUnder13 };
  },

  async setGenrePrefs(_genres) {
    await delay(200);
  },

  async setReadingGoal(year, goalBooks) {
    await delay();
    return { ...MOCK_READING_GOAL, year, goalBooks };
  },

  async updateProfile(data) {
    await delay();
    _user = {
      ..._user,
      username: data.username ?? _user.username,
      displayName: data.displayName ?? _user.displayName,
      theme: (data.theme as ThemePref) ?? _user.theme,
    };
    return { ..._user };
  },

  async completeOnboarding() {
    await delay(200);
    _user = { ..._user, onboardingCompletedAt: new Date().toISOString() };
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

  async updateBookStatus(userBookId: string, status: ReadingStatus) {
    await delay();
    const found = MOCK_USER_BOOKS.find((b) => b.id === userBookId) ?? MOCK_USER_BOOK;
    return { ...found, status } as UserBook;
  },

  async updateCurrentPage(_userBookId: string, _page: number) {
    await delay(100);
  },

  async removeBook(userBookId: string) {
    await delay(200);
    const i = MOCK_USER_BOOKS.findIndex((b) => b.id === userBookId);
    if (i >= 0) MOCK_USER_BOOKS.splice(i, 1); // in-session removal so the shelf updates
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
    const hit = Math.random() < 0.35 ? milestones[Math.floor(Math.random() * milestones.length)] : null;
    const streakCurrent = hit ? hit.count : 13;

    return {
      ok: true,
      deduped: false,
      sessionId: 'mock-session-' + Date.now(),
      pagesRead,
      pph,
      durationSeconds,
      isPersonalBest: false,
      streak: { current: streakCurrent, incremented: true, restoredViaGrace: false },
      xpGained: 72,
      newBadges: [],
      comeback: null,
      // The milestone is the bigger reward — don't stack an insight on top of it.
      insight: !hit && Math.random() < 0.3 ? { ...MOCK_INSIGHT, id: 'insight-' + Date.now() } : null,
      milestoneVariant: hit ? hit.variant : null,
    };
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
    return review;
  },

  async getReviews(bookId: string) {
    await delay();
    return (MOCK_REVIEWS[bookId] ?? []).map((r) => ({ ...r }));
  },

  // ── Account ────────────────────────────────────────────────────────────────
  async exportData() {
    await delay(400);
    return JSON.stringify({ exportedAt: new Date().toISOString(), user: _user, note: 'mock export' }, null, 2);
  },

  async deleteAccount() {
    await delay(300);
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
