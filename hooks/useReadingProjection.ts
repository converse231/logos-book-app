// Reading goal projection — blueprint Section 13.
// Computes instantly with sane defaults before any real reading data exists
// (300 pages/book, 60 PPH). After real data accrues the backend will swap in
// the user's measured averages via `averages`.

export interface ReadingProjection {
  goalBooks: number;
  daysRemaining: number;
  booksPerDay: number;
  minPerDay: number; // recommended daily minutes
  projectedBooks: number;
  projectedPages: number;
  deadlineLabel: string; // "by Dec 31"
  isEstimate: boolean; // true when using defaults (no real data yet)
  isDecemberCrunch: boolean; // goal set late in the year → ambitious pace
}

const DEFAULT_PAGES_PER_BOOK = 300;
const DEFAULT_PPH = 60;

interface UserAverages {
  avgPph: number | null;
  avgPagesPerBook: number | null;
}

export function computeReadingProjection(
  goalBooks: number,
  averages: UserAverages = { avgPph: null, avgPagesPerBook: null },
  now: Date = new Date()
): ReadingProjection {
  const pph = averages.avgPph ?? DEFAULT_PPH;
  const pagesBook = averages.avgPagesPerBook ?? DEFAULT_PAGES_PER_BOOK;

  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const msLeft = yearEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(msLeft / 86_400_000)); // clamp ≥1

  const booksPerDay = goalBooks / daysRemaining;
  const pagesPerDay = booksPerDay * pagesBook;
  const minPerDay = Math.max(5, Math.round((pagesPerDay / pph) * 60)); // floor 5 min
  const projectedPages = Math.round(goalBooks * pagesBook);

  return {
    goalBooks,
    daysRemaining,
    booksPerDay,
    minPerDay,
    projectedBooks: goalBooks,
    projectedPages,
    deadlineLabel: 'by Dec 31',
    isEstimate: averages.avgPph == null,
    isDecemberCrunch: daysRemaining <= 31,
  };
}

/** Hook form — recomputes synchronously from the goal (and optional averages). */
export function useReadingProjection(
  goalBooks: number,
  averages?: UserAverages
): ReadingProjection {
  return computeReadingProjection(goalBooks, averages);
}
