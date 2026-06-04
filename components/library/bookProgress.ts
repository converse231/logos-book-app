import { UserBook } from '@/services/types';

// Format-aware progress (blueprint format rule). Audiobooks track minutes, not
// pages — guarding the denominator keeps averages out of NaN / Infinity. Returns
// a 0–1 fraction plus the raw value/max so callers can render either.
export interface BookProgress {
  value: number;
  max: number;
  pct: number;
  isAudio: boolean;
}

export function getBookProgress(ub: UserBook): BookProgress {
  const isAudio = ub.format === 'audiobook';
  const value = isAudio ? ub.currentPositionMin : ub.currentPage;
  const max = isAudio
    ? ub.totalDurationMinutes ?? ub.book.durationMinutes ?? 0
    : ub.pageCountOverride ?? ub.book.pageCount ?? 0;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return { value, max, pct, isAudio };
}
