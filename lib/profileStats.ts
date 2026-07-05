// ─────────────────────────────────────────────────────────────────────────────
// Profile stat derivations (client-side, from already-fetched user_books +
// sessions). Keeps the profile screen lean. Scope = 'all' | 'year'.
// ─────────────────────────────────────────────────────────────────────────────

import { ReadingSession, UserBook } from '@/services/types';

export type Scope = 'all' | 'year';

export interface Tally {
  label: string;
  count: number;
}
export interface ChartBar {
  label: string;
  count: number;
}

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function yearOf(iso: string | null | undefined): number | null {
  return iso ? new Date(iso).getFullYear() : null;
}

/** Books the user has finished, optionally narrowed to a calendar year. */
export function finishedBooks(books: UserBook[], scope: Scope, year: number): UserBook[] {
  return books.filter(
    (b) => b.status === 'finished' && (scope === 'all' || yearOf(b.finishedAt) === year)
  );
}

function topCount(values: (string | undefined | null)[]): Tally | null {
  const tally = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  let best: Tally | null = null;
  for (const [label, count] of tally) {
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

export function topAuthor(finished: UserBook[]): Tally | null {
  return topCount(finished.map((b) => b.book.authors?.[0]));
}
export function topGenre(finished: UserBook[]): Tally | null {
  return topCount(finished.map((b) => b.book.genres?.[0]));
}

/** Books finished per period. scope 'year' → 12 months of `year`; 'all' → per year. */
export function finishedChart(books: UserBook[], scope: Scope, year: number): ChartBar[] {
  const done = books.filter((b) => b.status === 'finished' && b.finishedAt);
  if (scope === 'year') {
    const months: ChartBar[] = MONTHS_SHORT.map((label) => ({ label, count: 0 }));
    for (const b of done) {
      const d = new Date(b.finishedAt!);
      if (d.getFullYear() === year) months[d.getMonth()].count += 1;
    }
    return months;
  }
  const byYear = new Map<number, number>();
  for (const b of done) {
    const y = new Date(b.finishedAt!).getFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  return [...byYear.keys()].sort().map((y) => ({ label: `'${String(y).slice(2)}`, count: byYear.get(y)! }));
}

/** uid map: user_book id → cover url, for joining sessions to covers. */
export function coverByUserBook(books: UserBook[]): Map<string, string | null> {
  return new Map(books.map((b) => [b.id, b.book.coverUrl ?? null]));
}

/** date 'YYYY-MM-DD' → cover url (or null for a read day with no cover). */
export function coversByDate(
  sessions: ReadingSession[],
  covers: Map<string, string | null>
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const s of sessions) {
    if (!map.has(s.localDate)) map.set(s.localDate, covers.get(s.userBookId) ?? null);
  }
  return map;
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Longest run of consecutive calendar days among the given YYYY-MM-DD dates. */
export function bestStreak(dates: Iterable<string>): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(shiftYmd(d, -1))) continue; // only count from a run start
    let len = 1;
    let cur = d;
    while (set.has(shiftYmd(cur, 1))) {
      cur = shiftYmd(cur, 1);
      len += 1;
    }
    if (len > best) best = len;
  }
  return best;
}

/** Session local-dates within a scope (year = current year). */
export function sessionDates(sessions: ReadingSession[], scope: Scope, year: number): string[] {
  return sessions
    .filter((s) => scope === 'all' || Number(s.localDate.slice(0, 4)) === year)
    .map((s) => s.localDate);
}
