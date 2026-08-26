// ─────────────────────────────────────────────────────────────────────────────
// What a finished book looks like in hindsight.
//
// Derived client-side from user_books + that book's reading_sessions, both of
// which the app already fetches — same approach as lib/profileStats.ts, and no
// backend work. Pure functions on purpose: the screen renders this, it does not
// compute it.
//
// Format matters throughout. Audiobook sessions carry minutes_listened and a
// NULL pages_read, so every page aggregate here returns null for them rather
// than dividing by nothing (blueprint §4, and the guard CLAUDE.md calls out).
// ─────────────────────────────────────────────────────────────────────────────

import type { BookFormat, ReadingSession, UserBook } from '@/services/types';

export interface RhythmBar {
  /** ISO date (or the first day of the bucket, when spans are bucketed). */
  date: string;
  /** Pages for paged books, minutes for audiobooks — whichever the format uses. */
  value: number;
  /** True for days inside the span with no session: the pauses are the point. */
  empty: boolean;
}

export interface BookReport {
  format: BookFormat;
  /** Null when there is nothing to report — no sessions logged against the book. */
  hasSessions: boolean;

  // ── the span ──
  startedAt: string | null;
  finishedAt: string | null;
  /** Calendar days from start to finish, inclusive. Null if either end is unknown. */
  daysToFinish: number | null;
  /** Distinct days with at least one session. */
  daysRead: number;
  /** Longest run of consecutive days inside the span with no session. */
  longestPauseDays: number;

  // ── the effort ──
  sessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
  longestSessionDate: string | null;
  personalBests: number;

  // ── paged only (null for audiobooks) ──
  totalPages: number | null;
  pagesPerHour: number | null;
  avgPagesPerSession: number | null;

  // ── the shape of the read ──
  rhythm: RhythmBar[];
  /** True when rhythm bars are weeks rather than days (long reads). */
  rhythmWeekly: boolean;

  // ── narrative ──
  /** Modal session start hour, 0-23. Null when sessions are too few to mean it. */
  peakHour: number | null;
  /** Negative = finished faster than your average book. Null without a baseline. */
  vsAverageDays: number | null;
}

const DAY = 86_400_000;

/** Midnight-anchored day index, so DST never shifts a boundary. */
function dayNum(iso: string): number {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}
function dayNumFromLocalDate(localDate: string): number {
  // local_date is a frozen calendar day captured at session time — parse it as
  // digits, never through Date(), which would re-apply a timezone and can shift
  // the day. slice(0,10) because some drivers hand back a full timestamp for a
  // `date` column, and split('-') on that yields NaN.
  const [y, m, d] = localDate.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}
function isoFromDayNum(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

/** Minutes a session ran, from whichever field its format populated. */
function sessionMinutes(s: ReadingSession): number {
  if (s.durationSeconds > 0) return s.durationSeconds / 60;
  return s.minutesListened ?? 0;
}

/**
 * Days between starting and finishing a book, for the comparison baseline.
 * Exported because the report needs it for *other* books too.
 */
export function bookSpanDays(b: UserBook): number | null {
  if (!b.startedAt || !b.finishedAt) return null;
  const d = dayNum(b.finishedAt) - dayNum(b.startedAt) + 1;
  return d > 0 ? d : null;
}

/**
 * Build the report.
 *
 * `allBooks` is only used for the "faster than your average" line; pass the
 * user's whole shelf and it works out the baseline from the other finished
 * books, or returns null when there aren't enough to say anything honest.
 */
export function buildBookReport(
  book: UserBook,
  allSessions: ReadingSession[],
  allBooks: UserBook[] = []
): BookReport {
  const mine = allSessions
    .filter((s) => s.userBookId === book.id)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));

  const isAudio = book.format === 'audiobook';
  const totalMinutes = mine.reduce((n, s) => n + sessionMinutes(s), 0);
  const pages = isAudio ? null : mine.reduce((n, s) => n + (s.pagesRead ?? 0), 0);

  // ── span ──
  const firstDay = mine.length ? dayNumFromLocalDate(mine[0].localDate) : null;
  const lastDay = mine.length ? dayNumFromLocalDate(mine[mine.length - 1].localDate) : null;
  // The stated dates cannot be trusted on their own: the finish date is
  // user-editable, so real shelves contain books "finished" before they were
  // started, and sessions logged outside both ends. Widening the span to cover
  // the stated dates AND every session keeps it positive and keeps the rhythm
  // chart from dropping bars it should be drawing.
  const stated = [
    book.startedAt ? dayNum(book.startedAt) : null,
    book.finishedAt ? dayNum(book.finishedAt) : null,
  ].filter((n): n is number => n != null);
  const bounds = [...stated, firstDay, lastDay].filter((n): n is number => n != null);
  const startDay = bounds.length ? Math.min(...bounds) : null;
  const endDay = bounds.length ? Math.max(...bounds) : null;
  const daysToFinish =
    startDay != null && endDay != null && endDay >= startDay ? endDay - startDay + 1 : null;

  const readDays = new Set(mine.map((s) => dayNumFromLocalDate(s.localDate)));

  // Longest stretch inside the span with nothing read. Measured between read
  // days, so a slow start or a long tail after the last session doesn't count.
  let longestPause = 0;
  const sortedRead = [...readDays].sort((a, b) => a - b);
  for (let i = 1; i < sortedRead.length; i++) {
    longestPause = Math.max(longestPause, sortedRead[i] - sortedRead[i - 1] - 1);
  }

  // ── effort ──
  let longestMin = 0;
  let longestDate: string | null = null;
  for (const s of mine) {
    const m = sessionMinutes(s);
    if (m > longestMin) {
      longestMin = m;
      longestDate = s.localDate;
    }
  }

  // ── rhythm ──
  // Every day in the span gets a bar, including the empty ones, because the
  // gaps are what give a read its shape. Long reads bucket to weeks so the
  // chart never becomes a hairline comb.
  const rhythmWeekly = daysToFinish != null && daysToFinish > 45;
  const bucketSize = rhythmWeekly ? 7 : 1;
  const rhythm: RhythmBar[] = [];
  if (startDay != null && endDay != null && endDay >= startDay) {
    const byDay = new Map<number, number>();
    for (const s of mine) {
      const d = dayNumFromLocalDate(s.localDate);
      const v = isAudio ? sessionMinutes(s) : s.pagesRead ?? 0;
      byDay.set(d, (byDay.get(d) ?? 0) + v);
    }
    for (let d = startDay; d <= endDay; d += bucketSize) {
      let sum = 0;
      let any = false;
      for (let k = 0; k < bucketSize && d + k <= endDay; k++) {
        const v = byDay.get(d + k);
        if (v != null) {
          sum += v;
          any = true;
        }
      }
      rhythm.push({ date: isoFromDayNum(d), value: Math.round(sum), empty: !any });
    }
  }

  // ── narrative ──
  // Modal start hour, but only once there are enough sessions for a mode to be
  // a habit rather than an accident.
  let peakHour: number | null = null;
  if (mine.length >= 4) {
    const hours = new Map<number, number>();
    for (const s of mine) {
      const h = new Date(s.startedAt).getHours();
      hours.set(h, (hours.get(h) ?? 0) + 1);
    }
    let best = -1;
    for (const [h, n] of hours) if (n > best) ((best = n), (peakHour = h));
    // A mode of 1 out of many is noise, not a habit.
    if (best < 2) peakHour = null;
  }

  // ── comparison ──
  const others = allBooks
    .filter((b) => b.id !== book.id && b.status === 'finished')
    .map(bookSpanDays)
    .filter((d): d is number => d != null);
  const vsAverageDays =
    others.length >= 2 && daysToFinish != null
      ? Math.round(daysToFinish - others.reduce((a, b) => a + b, 0) / others.length)
      : null;

  const hours = totalMinutes / 60;
  return {
    format: book.format,
    hasSessions: mine.length > 0,
    startedAt: book.startedAt ?? (mine[0]?.localDate ?? null),
    finishedAt: book.finishedAt,
    daysToFinish,
    daysRead: readDays.size,
    longestPauseDays: longestPause,
    sessions: mine.length,
    totalMinutes: Math.round(totalMinutes),
    avgSessionMinutes: mine.length ? Math.round(totalMinutes / mine.length) : 0,
    longestSessionMinutes: Math.round(longestMin),
    longestSessionDate: longestDate,
    personalBests: mine.filter((s) => s.isPersonalBest).length,
    totalPages: pages,
    pagesPerHour: pages != null && hours > 0 ? Math.round(pages / hours) : null,
    avgPagesPerSession: pages != null && mine.length ? Math.round(pages / mine.length) : null,
    rhythm,
    rhythmWeekly,
    peakHour,
    vsAverageDays,
  };
}

// ── formatting helpers, shared by the screen and the share card ──────────────

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${ampm}`;
}

/** "12 Aug" — short, unambiguous, no year unless it differs from the finish. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MONTHS[m - 1]}${y === new Date().getFullYear() ? '' : ` ${y}`}`;
}
