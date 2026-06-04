import { create } from 'zustand';
import { BookFormat } from '@/services/types';

// Library shelf view preferences. Lives in a store (not route params) so the
// filter-sort sheet — a separate modal route — can write the selection and have
// the shelf react instantly, the same pattern sessionStore uses for the tracker.
export type LibrarySort = 'recent' | 'title' | 'author' | 'progress';
export type FormatFilter = 'all' | BookFormat;

export const SORT_LABELS: Record<LibrarySort, string> = {
  recent: 'Recently added',
  title: 'Title (A–Z)',
  author: 'Author (A–Z)',
  progress: 'Progress',
};

export const FORMAT_LABELS: Record<FormatFilter, string> = {
  all: 'All formats',
  physical: 'Physical',
  ebook: 'E-book',
  audiobook: 'Audiobook',
};

interface LibraryState {
  sort: LibrarySort;
  formatFilter: FormatFilter;
  favoritesOnly: boolean;
  setSort: (sort: LibrarySort) => void;
  setFormatFilter: (f: FormatFilter) => void;
  setFavoritesOnly: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS = { sort: 'recent' as LibrarySort, formatFilter: 'all' as FormatFilter, favoritesOnly: false };

export const useLibraryStore = create<LibraryState>((set) => ({
  ...DEFAULTS,
  setSort: (sort) => set({ sort }),
  setFormatFilter: (formatFilter) => set({ formatFilter }),
  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
  reset: () => set({ ...DEFAULTS }),
}));

/** True when any filter/sort differs from the default — drives the "active" dot on the filter button. */
export function isLibraryFilterActive(s: Pick<LibraryState, 'sort' | 'formatFilter' | 'favoritesOnly'>): boolean {
  return s.sort !== DEFAULTS.sort || s.formatFilter !== DEFAULTS.formatFilter || s.favoritesOnly !== DEFAULTS.favoritesOnly;
}
