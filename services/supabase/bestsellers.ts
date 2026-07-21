// ─────────────────────────────────────────────────────────────────────────────
// B6 — NYT bestsellers (read-only). The bestseller_lists table is refreshed
// weekly server-side by the sync_bestsellers edge function (cron); the client
// just reads the cached rows (world-readable RLS) and maps them to the same
// BookSearchResult shape the Discover carousels already render.
// ─────────────────────────────────────────────────────────────────────────────

import type { QuireApi } from '../api';
import type { BookSearchResult } from '../types';
import { supabase } from '@/lib/supabase';

function mapBestseller(r: any): BookSearchResult {
  return {
    // Synthetic stable id for list keys; tapping routes by title+author anyway.
    googleBooksId: r.isbn_13 ? `nyt:${r.isbn_13}` : `nyt:${r.list_name}:${r.rank}`,
    title: r.title,
    authors: r.author ? [r.author] : [],
    coverUrl: r.cover_url ?? null,
    pageCount: null,
    durationMinutes: null,
    publishedYear: null,
    genres: [],
    description: r.description ?? null,
    isbn13: r.isbn_13 ?? null,
  };
}

export const bestsellerApi: Partial<QuireApi> = {
  async getBestsellers(list = 'hardcover-fiction') {
    const { data, error } = await supabase
      .from('bestseller_lists')
      .select('*')
      .eq('list_name', list)
      .order('rank', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapBestseller);
  },
};
