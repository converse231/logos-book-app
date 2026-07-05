// Realistic fixture data for the mock API.
// Every fixture is grounded in the blueprint's data model (Section 1).

import {
  Badge,
  Book,
  BookSearchResult,
  ComebackChallenge,
  HomeData,
  ReadingGoal,
  ReadingInsight,
  ReadingSession,
  Review,
  StatsData,
  StreakState,
  UserBook,
  UserProfile,
} from '../types';

// Open Library serves stable cover art keyed by ISBN — real images for the mock
// shelf. BookCover degrades to a placeholder if any one fails to load.
const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const MOCK_USER: UserProfile = {
  id: 'mock-user-1',
  email: 'alex@example.com',
  username: 'literaryathlete',
  displayName: 'Alex Reader',
  bio: 'Chasing one more chapter. Sci-fi, literary fiction, the occasional thriller.',
  genrePrefs: ['Science Fiction', 'Literary Fiction', 'Thriller'],
  avatarUrl: null,
  birthYear: 1995,
  isMinor: false,
  isUnder13: false,
  theme: 'dark',
  timezoneOffsetMinutes: -300, // EST
  timezoneName: 'America/New_York',
  totalXp: 4200,
  level: 4,
  levelName: 'Shelf Builder',
  subscriptionStatus: 'free',
  onboardingCompletedAt: null,
};

export const MOCK_BOOK: Book = {
  id: 'book-1',
  googleBooksId: 'gb-atomic-habits',
  title: 'Atomic Habits',
  subtitle: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones',
  authors: ['James Clear'],
  coverUrl: cover('9780735211292'),
  pageCount: 320,
  durationMinutes: null,
  publishedYear: 2018,
  genres: ['Self-Help', 'Psychology'],
  description:
    'Tiny changes, remarkable results. James Clear distils the science of habit formation into a framework for getting one percent better every day, showing how small routines compound into outsized outcomes over time.',
};

export const MOCK_USER_BOOK: UserBook = {
  id: 'user-book-1',
  userId: 'mock-user-1',
  book: MOCK_BOOK,
  format: 'physical',
  status: 'reading',
  currentPage: 142,
  currentPositionMin: 0,
  pageCountOverride: null,
  totalDurationMinutes: null,
  seriesName: null,
  seriesNumber: null,
  startedAt: '2026-05-20T10:00:00Z',
  finishedAt: null,
  isFavorite: false,
};

// ── Catalog (books) ────────────────────────────────────────────────────────
// The first entry mirrors MOCK_BOOK (the active read on Home). The rest populate
// the shelf and the add-book search. Page counts / durations are real-ish so the
// progress math reads true.

export const MOCK_BOOKS: Book[] = [
  MOCK_BOOK,
  {
    id: 'book-2',
    googleBooksId: 'gb-project-hail-mary',
    title: 'Project Hail Mary',
    subtitle: null,
    authors: ['Andy Weir'],
    coverUrl: cover('9780593135204'),
    pageCount: 496,
    durationMinutes: null,
    publishedYear: 2021,
    genres: ['Science Fiction'],
    description:
      'A lone astronaut wakes with no memory aboard a ship at the edge of the solar system, the last hope for a dying Earth. What he finds out there turns a survival story into an unlikely friendship.',
  },
  {
    id: 'book-3',
    googleBooksId: 'gb-midnight-library',
    title: 'The Midnight Library',
    subtitle: null,
    authors: ['Matt Haig'],
    coverUrl: cover('9780525559474'),
    pageCount: 304,
    durationMinutes: null,
    publishedYear: 2020,
    genres: ['Fiction', 'Fantasy'],
    description:
      'Between life and death stands a library, and every book offers the chance to try another version of your life. A story about regret, possibility, and the weight of the choices we never made.',
  },
  {
    id: 'book-4',
    googleBooksId: 'gb-dune',
    title: 'Dune',
    subtitle: null,
    authors: ['Frank Herbert'],
    coverUrl: cover('9780441013593'),
    pageCount: 412,
    durationMinutes: null,
    publishedYear: 1965,
    genres: ['Science Fiction'],
    description:
      'On the desert planet Arrakis, the only source of the universe’s most valuable substance, a betrayed heir must become something more than human to survive and lead.',
  },
  {
    id: 'book-5',
    googleBooksId: 'gb-educated',
    title: 'Educated',
    subtitle: 'A Memoir',
    authors: ['Tara Westover'],
    coverUrl: cover('9780399590504'),
    pageCount: 334,
    durationMinutes: 734, // audiobook runtime ~12h14m
    publishedYear: 2018,
    genres: ['Memoir'],
    description:
      'Born to survivalists in the Idaho mountains, Tara Westover never set foot in a classroom until seventeen. Her journey out is a reckoning with family, loyalty, and the cost of self-invention.',
  },
  {
    id: 'book-6',
    googleBooksId: 'gb-song-of-achilles',
    title: 'The Song of Achilles',
    subtitle: null,
    authors: ['Madeline Miller'],
    coverUrl: cover('9780062060624'),
    pageCount: 416,
    durationMinutes: null,
    publishedYear: 2011,
    genres: ['Historical Fiction', 'Fantasy'],
    description:
      'A retelling of the Iliad through the bond between Achilles and Patroclus, from boyhood to the shores of Troy, where glory and love pull in opposite directions.',
  },
  {
    id: 'book-7',
    googleBooksId: 'gb-sapiens',
    title: 'Sapiens',
    subtitle: 'A Brief History of Humankind',
    authors: ['Yuval Noah Harari'],
    coverUrl: cover('9780062316097'),
    pageCount: 464,
    durationMinutes: null,
    publishedYear: 2011,
    genres: ['History', 'Nonfiction'],
    description:
      'How did an unremarkable ape come to rule the planet? Harari traces the cognitive, agricultural, and scientific revolutions that built the world we take for granted.',
  },
  {
    id: 'book-8',
    googleBooksId: 'gb-klara-and-the-sun',
    title: 'Klara and the Sun',
    subtitle: null,
    authors: ['Kazuo Ishiguro'],
    coverUrl: cover('9780571364886'),
    pageCount: 320,
    durationMinutes: null,
    publishedYear: 2021,
    genres: ['Science Fiction', 'Literary Fiction'],
    description:
      'Klara, an artificial friend with keen observational gifts, watches the world from a store window and waits to be chosen, then learns what devotion costs.',
  },
  // Catalog-only — surfaced by add-book search, not yet on the shelf.
  {
    id: 'book-9',
    googleBooksId: 'gb-tomorrow-tomorrow',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    subtitle: null,
    authors: ['Gabrielle Zevin'],
    coverUrl: cover('9780593321201'),
    pageCount: 416,
    durationMinutes: null,
    publishedYear: 2022,
    genres: ['Fiction'],
    description:
      'Two friends, collaborators, and sometime rivals build worlds together across thirty years of work, love, and game design.',
  },
  {
    id: 'book-10',
    googleBooksId: 'gb-three-body-problem',
    title: 'The Three-Body Problem',
    subtitle: null,
    authors: ['Liu Cixin'],
    coverUrl: cover('9780765382030'),
    pageCount: 416,
    durationMinutes: null,
    publishedYear: 2008,
    genres: ['Science Fiction'],
    description:
      'Against the backdrop of the Cultural Revolution, a secret military project makes contact with another civilization, and humanity’s future is set on an irreversible course.',
  },
  {
    id: 'book-11',
    googleBooksId: 'gb-circe',
    title: 'Circe',
    subtitle: null,
    authors: ['Madeline Miller'],
    coverUrl: cover('9780316556347'),
    pageCount: 400,
    durationMinutes: null,
    publishedYear: 2018,
    genres: ['Fantasy', 'Mythology'],
    description:
      'Banished to a remote island, the witch Circe hones her powers and crosses paths with gods and mortals alike, forging an identity on her own terms.',
  },
];

// Hydrate the catalog rows with publisher / ISBN / language (books table,
// blueprint Section 1) so the book-detail screen can surface real metadata.
const BOOK_META: Record<string, { publisher: string; isbn13: string }> = {
  'book-1': { publisher: 'Avery', isbn13: '9780735211292' },
  'book-2': { publisher: 'Ballantine Books', isbn13: '9780593135204' },
  'book-3': { publisher: 'Viking', isbn13: '9780525559474' },
  'book-4': { publisher: 'Ace', isbn13: '9780441013593' },
  'book-5': { publisher: 'Random House', isbn13: '9780399590504' },
  'book-6': { publisher: 'Ecco', isbn13: '9780062060624' },
  'book-7': { publisher: 'Harper', isbn13: '9780062316097' },
  'book-8': { publisher: 'Knopf', isbn13: '9780571364886' },
  'book-9': { publisher: 'Knopf', isbn13: '9780593321201' },
  'book-10': { publisher: 'Tor Books', isbn13: '9780765382030' },
  'book-11': { publisher: 'Little, Brown and Company', isbn13: '9780316556347' },
};
MOCK_BOOKS.forEach((b) => {
  const meta = BOOK_META[b.id];
  if (meta) {
    b.publisher = meta.publisher;
    b.isbn13 = meta.isbn13;
  }
  b.language = 'en';
});

const bookById = (id: string) => MOCK_BOOKS.find((b) => b.id === id)!;

// ── Shelf (user_books) ───────────────────────────────────────────────────────

export const MOCK_USER_BOOKS: UserBook[] = [
  MOCK_USER_BOOK, // Atomic Habits — physical, reading (also the Home active book)
  {
    id: 'user-book-2',
    userId: 'mock-user-1',
    book: bookById('book-2'),
    format: 'ebook',
    status: 'reading',
    currentPage: 318,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: null,
    seriesNumber: null,
    startedAt: daysAgo(9),
    finishedAt: null,
    isFavorite: true,
  },
  {
    id: 'user-book-5',
    userId: 'mock-user-1',
    book: bookById('book-5'),
    format: 'audiobook',
    status: 'reading',
    currentPage: 0,
    currentPositionMin: 312,
    pageCountOverride: null,
    totalDurationMinutes: 734,
    seriesName: null,
    seriesNumber: null,
    startedAt: daysAgo(4),
    finishedAt: null,
    isFavorite: false,
  },
  {
    id: 'user-book-3',
    userId: 'mock-user-1',
    book: bookById('book-3'),
    format: 'physical',
    status: 'finished',
    currentPage: 304,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: null,
    seriesNumber: null,
    startedAt: daysAgo(40),
    finishedAt: daysAgo(28),
    isFavorite: true,
  },
  {
    id: 'user-book-6',
    userId: 'mock-user-1',
    book: bookById('book-6'),
    format: 'physical',
    status: 'finished',
    currentPage: 416,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: null,
    seriesNumber: null,
    startedAt: daysAgo(70),
    finishedAt: daysAgo(52),
    isFavorite: false,
  },
  {
    id: 'user-book-4',
    userId: 'mock-user-1',
    book: bookById('book-4'),
    format: 'physical',
    status: 'want',
    currentPage: 0,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: 'Dune',
    seriesNumber: 1,
    startedAt: null,
    finishedAt: null,
    isFavorite: false,
  },
  {
    id: 'user-book-8',
    userId: 'mock-user-1',
    book: bookById('book-8'),
    format: 'ebook',
    status: 'tbr',
    currentPage: 0,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: null,
    seriesNumber: null,
    startedAt: null,
    finishedAt: null,
    isFavorite: false,
  },
  {
    id: 'user-book-7',
    userId: 'mock-user-1',
    book: bookById('book-7'),
    format: 'physical',
    status: 'dnf',
    currentPage: 188,
    currentPositionMin: 0,
    pageCountOverride: null,
    totalDurationMinutes: null,
    seriesName: null,
    seriesNumber: null,
    startedAt: daysAgo(120),
    finishedAt: null,
    isFavorite: false,
  },
];

// ── Reviews ──────────────────────────────────────────────────────────────────
// Keyed by book id. Includes the current user's own review on finished titles
// plus community reviews (denormalised author names, as the server join returns).

export const MOCK_REVIEWS: Record<string, Review[]> = {
  'book-3': [
    {
      id: 'review-mine-3',
      userId: 'mock-user-1',
      bookId: 'book-3',
      rating: 5,
      body: 'Read it in two sittings. The premise sounds gimmicky and then it quietly wrecks you.',
      containsSpoilers: false,
      isPublic: true,
      createdAt: daysAgo(27),
      userName: 'Alex Reader',
      userAvatarUrl: null,
    },
    {
      id: 'review-3-a',
      userId: 'user-marisol',
      bookId: 'book-3',
      rating: 4,
      body: 'A warm, forgiving book about regret. The middle drags a little but the ending earns it.',
      containsSpoilers: false,
      isPublic: true,
      createdAt: daysAgo(33),
      userName: 'Marisol Vega',
      userAvatarUrl: null,
    },
    {
      id: 'review-3-b',
      userId: 'user-devin',
      bookId: 'book-3',
      rating: 5,
      body: 'The library scenes hit harder than I expected. Stayed with me for days.',
      containsSpoilers: false,
      isPublic: true,
      createdAt: daysAgo(48),
      userName: 'Devin Okafor',
      userAvatarUrl: null,
    },
  ],
  'book-6': [
    {
      id: 'review-6-a',
      userId: 'user-priya',
      bookId: 'book-6',
      rating: 5,
      body: 'Miller writes grief like nobody else. I knew how it ended and still wasn’t ready.',
      containsSpoilers: true,
      isPublic: true,
      createdAt: daysAgo(55),
      userName: 'Priya Nair',
      userAvatarUrl: null,
    },
    {
      id: 'review-6-b',
      userId: 'user-soren',
      bookId: 'book-6',
      rating: 4,
      body: 'Gorgeous prose. Slow to start if you don’t already love the myth, but worth it.',
      containsSpoilers: false,
      isPublic: true,
      createdAt: daysAgo(61),
      userName: 'Søren Halvorsen',
      userAvatarUrl: null,
    },
  ],
};

// ── Search catalog ─────────────────────────────────────────────────────────
// What add-book queries against. Mirrors the catalog as Google Books results.

export const MOCK_SEARCH_CATALOG: BookSearchResult[] = MOCK_BOOKS.map((b) => ({
  googleBooksId: b.googleBooksId ?? b.id,
  title: b.title,
  authors: b.authors,
  coverUrl: b.coverUrl,
  pageCount: b.pageCount,
  durationMinutes: b.durationMinutes,
  publishedYear: b.publishedYear,
  genres: b.genres,
  description: b.description,
}));

// Shown in add-book before the user searches — a curated "popular right now" set.
export const MOCK_RECOMMENDED: BookSearchResult[] = MOCK_SEARCH_CATALOG.filter((b) =>
  ['gb-tomorrow-tomorrow', 'gb-three-body-problem', 'gb-circe', 'gb-klara-and-the-sun', 'gb-dune', 'gb-sapiens'].includes(
    b.googleBooksId
  )
);

export const MOCK_STREAK: StreakState = {
  currentStreak: 12,
  longestStreak: 23,
  lastReadLocalDate: new Date().toISOString().slice(0, 10),
  isAtRisk: false,
  freezeTokens: 0,
};

export const MOCK_COMEBACK: ComebackChallenge = {
  id: 'comeback-1',
  streakAtBreak: 23,
  sessionsCompleted: 1,
  startedAt: daysAgo(1),
  expiresAt: new Date(Date.now() + 172800000).toISOString(), // 2 days left
  completedAt: null,
  expiredAt: null,
  streakRestored: false,
};

export const MOCK_BADGE: Badge = {
  id: 'badge-week-warrior',
  slug: 'week_warrior',
  name: 'Week Warrior',
  description: 'Read every day for a week straight.',
  kind: 'streak',
  iconName: 'flame',
  lottieKey: null,
  unlockThreshold: 7,
  almostThereThreshold: 0.8,
  xpReward: 100,
  unlockedAt: daysAgo(20),
  progressValue: 12,
};

// Full achievement set for the Stats screen — a mix of unlocked, in-progress,
// and locked across every achievement kind. `unlockedAt: null` = not yet earned;
// `progressValue / unlockThreshold` drives the progress UI.
export const MOCK_BADGES: Badge[] = [
  {
    id: 'badge-first-light',
    slug: 'first_light',
    name: 'First Light',
    description: 'Finish your very first reading session.',
    kind: 'volume',
    iconName: 'sparkles',
    lottieKey: null,
    unlockThreshold: 1,
    almostThereThreshold: 1,
    xpReward: 50,
    unlockedAt: daysAgo(80),
    progressValue: 1,
  },
  MOCK_BADGE,
  {
    id: 'badge-speed-reader',
    slug: 'speed_reader',
    name: 'Speed Reader',
    description: 'Hit a pace of 60 pages an hour in a single session.',
    kind: 'speed',
    iconName: 'flash',
    lottieKey: null,
    unlockThreshold: 60,
    almostThereThreshold: 0.8,
    xpReward: 120,
    unlockedAt: daysAgo(12),
    progressValue: 60,
  },
  {
    id: 'badge-centurion',
    slug: 'centurion',
    name: 'Centurion',
    description: 'Read 100 pages in a single day.',
    kind: 'volume',
    iconName: 'reader',
    lottieKey: null,
    unlockThreshold: 100,
    almostThereThreshold: 0.7,
    xpReward: 200,
    unlockedAt: null,
    progressValue: 72,
  },
  {
    id: 'badge-night-owl',
    slug: 'night_owl',
    name: 'Night Owl',
    description: 'Read after 11pm on ten different nights.',
    kind: 'consistency',
    iconName: 'moon',
    lottieKey: null,
    unlockThreshold: 10,
    almostThereThreshold: 0.7,
    xpReward: 150,
    unlockedAt: null,
    progressValue: 7,
  },
  {
    id: 'badge-bookworm',
    slug: 'bookworm',
    name: 'Bookworm',
    description: 'Finish 25 books.',
    kind: 'volume',
    iconName: 'library',
    lottieKey: null,
    unlockThreshold: 25,
    almostThereThreshold: 0.8,
    xpReward: 250,
    unlockedAt: null,
    progressValue: 12,
  },
  {
    id: 'badge-marathoner',
    slug: 'marathoner',
    name: 'Marathoner',
    description: 'Keep a 30-day reading streak.',
    kind: 'streak',
    iconName: 'flame',
    lottieKey: null,
    unlockThreshold: 30,
    almostThereThreshold: 0.8,
    xpReward: 300,
    unlockedAt: null,
    progressValue: 12,
  },
  {
    id: 'badge-storyteller',
    slug: 'storyteller',
    name: 'Storyteller',
    description: 'Share five reading cards with friends.',
    kind: 'social',
    iconName: 'share-social',
    lottieKey: null,
    unlockThreshold: 5,
    almostThereThreshold: 0.8,
    xpReward: 100,
    unlockedAt: null,
    progressValue: 2,
  },
  {
    id: 'badge-dawn-patrol',
    slug: 'dawn_patrol',
    name: 'Dawn Patrol',
    description: 'Read before 7am on five mornings.',
    kind: 'consistency',
    iconName: 'sunny',
    lottieKey: null,
    unlockThreshold: 5,
    almostThereThreshold: 0.8,
    xpReward: 150,
    unlockedAt: null,
    progressValue: 0,
  },
  {
    id: 'badge-logos-legend',
    slug: 'logos_legend',
    name: 'Logos Legend',
    description: 'Reach a 365-day reading streak.',
    kind: 'milestone',
    iconName: 'trophy',
    lottieKey: null,
    unlockThreshold: 365,
    almostThereThreshold: 0.9,
    xpReward: 1000,
    unlockedAt: null,
    progressValue: 12,
  },
];

export const MOCK_READING_GOAL: ReadingGoal = {
  id: 'goal-2026',
  userId: 'mock-user-1',
  year: 2026,
  goalBooks: 24,
  goalPages: null,
};

export const MOCK_INSIGHT: ReadingInsight = {
  id: 'insight-1',
  sessionId: 'session-1',
  insightType: 'PACE_TREND',
  insightText: 'Your reading speed has increased 18% over the last 30 days.',
  dataSnapshot: { pct: 18, pphStart: 42, pphNow: 50 },
  shownAt: new Date().toISOString(),
  wasShared: false,
};

export const MOCK_SESSIONS: ReadingSession[] = [
  {
    id: 'session-1',
    userId: 'mock-user-1',
    userBookId: 'user-book-1',
    bookId: 'book-1',
    format: 'physical',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    endedAt: new Date(Date.now() - 600000).toISOString(),
    durationSeconds: 3000,
    startPage: 118,
    endPage: 142,
    pagesRead: 24,
    minutesListened: null,
    pph: 28.8,
    source: 'live',
    localDate: new Date().toISOString().slice(0, 10),
    xpAwarded: 72,
    isPersonalBest: false,
  },
];

const heatmapDays = Array.from({ length: 90 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (89 - i));
  return {
    date: d.toISOString().slice(0, 10),
    minutes: Math.random() > 0.3 ? Math.floor(Math.random() * 90 + 10) : 0,
  };
});

export const MOCK_STATS: StatsData = {
  lifetimePages: 3840,
  lifetimeHours: 64,
  booksFinished: 12,
  avgPph: 48,
  currentStreak: 12,
  longestStreak: 23,
  heatmapDays,
  badges: MOCK_BADGES,
  sessions: MOCK_SESSIONS,
};

export const MOCK_HOME_DATA: HomeData = {
  user: {
    id: MOCK_USER.id,
    displayName: MOCK_USER.displayName,
    avatarUrl: MOCK_USER.avatarUrl,
    levelName: MOCK_USER.levelName,
    level: MOCK_USER.level,
    totalXp: MOCK_USER.totalXp,
  },
  streak: MOCK_STREAK,
  activeBook: MOCK_USER_BOOK,
  comeback: MOCK_COMEBACK,
  almostThere: {
    kind: 'badge',
    label: '28 pages from the Centurion badge',
    progress: 72 / 100,
    badgeSlug: 'centurion',
  },
  goal: MOCK_READING_GOAL,
  recentSessions: MOCK_SESSIONS,
  xpToNextLevel: 6000, // total XP at which Spine Cracker (Lv 5) unlocks
  prevLevelXp: 3500, // total XP at which Shelf Builder (Lv 4) began
};
