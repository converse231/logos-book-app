import type { ReadingStatus } from '@/services/types';

// The one vocabulary for a book's shelf status. It had split three ways — cards
// said "Want to read / Did not finish", add-book and book detail said "Wishlist /
// Set aside", the filter chips said "Want / DNF" — so the same book changed name
// depending on which screen you were looking at.
//
// `want` is the wishlist (you don't own it); `tbr` is owned and unread. That split
// is the reason both words exist, so neither label may drift toward the other.

/** Sentence form — detail rows, "On your shelf · …", card footers (uppercased). */
export const STATUS_LABEL: Record<ReadingStatus, string> = {
  want: 'Wishlist',
  tbr: 'To be read',
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'Did not finish',
};

/** Chip form — filter tabs and status pickers, where width is tight. */
export const STATUS_SHORT: Record<ReadingStatus, string> = {
  want: 'Wishlist',
  tbr: 'TBR',
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'DNF',
};
