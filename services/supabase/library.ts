// ─────────────────────────────────────────────────────────────────────────────
// B3 — library, search, reviews. Owner-scoped direct queries against user_books
// + reviews (RLS enforces auth.uid() = user_id); catalog search runs client-side
// (Google Books / Open Library, no key); addBook routes the catalog upsert
// through the ensure_book edge function (service-role write to public.books).
// ─────────────────────────────────────────────────────────────────────────────

import type { LogosApi } from '../api';
import type { Book, BookFormat, BookSearchResult, ReadingStatus, Review, UserBook } from '../types';
import { supabase } from '@/lib/supabase';
import { recommendedBooks, searchBooks as catalogSearch, enrichFromOpenLibrary, type EnsureBookInput } from '@/lib/bookSearch';

const USER_BOOK_SELECT = '*, book:books(*)';

export function mapBook(r: any): Book {
  return {
    id: r.id,
    googleBooksId: r.google_books_id ?? null,
    title: r.title,
    subtitle: r.subtitle ?? null,
    authors: r.authors ?? [],
    coverUrl: r.cover_url ?? null,
    pageCount: r.page_count ?? null,
    durationMinutes: r.duration_minutes ?? null,
    publishedYear: r.published_year ?? null,
    genres: r.genres ?? [],
    description: r.description ?? null,
    publisher: r.publisher ?? null,
    isbn13: r.isbn_13 ?? null,
    language: r.language ?? 'en',
  };
}

export function mapUserBook(r: any): UserBook {
  return {
    id: r.id,
    userId: r.user_id,
    book: mapBook(r.book),
    format: r.format as BookFormat,
    status: r.status as ReadingStatus,
    currentPage: r.current_page ?? 0,
    currentPositionMin: r.current_position_min ?? 0,
    pageCountOverride: r.page_count_override ?? null,
    totalDurationMinutes: r.total_duration_minutes ?? null,
    seriesName: r.series_name ?? null,
    seriesNumber: r.series_number != null ? Number(r.series_number) : null,
    startedAt: r.started_at ?? null,
    finishedAt: r.finished_at ?? null,
    isFavorite: r.is_favorite ?? false,
  };
}

function mapReview(r: any, profile?: { display_name: string | null; avatar_url: string | null }): Review {
  return {
    id: r.id,
    userId: r.user_id,
    bookId: r.book_id,
    rating: r.rating,
    body: r.body ?? null,
    containsSpoilers: r.contains_spoilers ?? false,
    isPublic: r.is_public ?? false,
    createdAt: r.created_at,
    userName: profile?.display_name ?? null,
    userAvatarUrl: profile?.avatar_url ?? null,
  };
}

// supabase.functions.invoke throws a FunctionsHttpError whose .context is the raw
// Response. Pull the function's `{ error }` JSON body out of it so the UI shows the
// true cause (a Postgres message, "Unauthorized", etc.) instead of the generic text.
async function readEdgeError(err: any): Promise<string> {
  const ctx = err?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // body wasn't JSON — fall through
    }
  }
  if (typeof ctx?.status === 'number') return `ensure_book failed (HTTP ${ctx.status}). ${err?.message ?? ''}`.trim();
  return err?.message ?? 'ensure_book request failed.';
}

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Not signed in.');
  return uid;
}

export const libraryApi: Partial<LogosApi> = {
  // ── Search (client-side catalog, no DB) ─────────────────────────────────────
  async searchBooks(query) {
    return catalogSearch(query);
  },

  async getRecommendedBooks() {
    return recommendedBooks();
  },

  // ── Shelf (owner-scoped RLS queries) ────────────────────────────────────────
  async getUserBooks(status?: ReadingStatus) {
    const uid = await requireUid();
    let q = supabase.from('user_books').select(USER_BOOK_SELECT).eq('user_id', uid);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapUserBook);
  },

  async getUserBook(userBookId: string) {
    const { data, error } = await supabase
      .from('user_books')
      .select(USER_BOOK_SELECT)
      .eq('id', userBookId)
      .single();
    if (error) throw error;
    return mapUserBook(data);
  },

  async addBook(book: BookSearchResult, format: BookFormat) {
    const uid = await requireUid();
    // 1) Build the catalog payload directly from the search result — no second
    //    network round-trip (the old re-fetch was an intermittent failure point).
    //    Open-Library-only results carry an `ol:`-prefixed id → map it across.
    const isOL = book.googleBooksId.startsWith('ol:');
    let meta: EnsureBookInput = {
      googleBooksId: isOL ? null : book.googleBooksId,
      openLibraryId: isOL ? book.googleBooksId.slice(3) : null,
      isbn13: book.isbn13 ?? null,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      pageCount: book.pageCount,
      durationMinutes: book.durationMinutes,
      publishedYear: book.publishedYear,
      genres: book.genres,
      description: book.description,
    };
    // Fill thin Google metadata (missing pages/description/subjects) from Open
    // Library by ISBN before persisting — one best-effort call, never blocks the add.
    meta = await enrichFromOpenLibrary(meta);
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('ensure_book', { body: meta });
    if (fnErr) {
      // functions.invoke hides the real reason behind a generic message; the
      // function's JSON { error } body lives on the thrown error's .context Response.
      const detail = await readEdgeError(fnErr);
      console.warn('[addBook] ensure_book failed:', detail, '| book:', meta.title, book.googleBooksId);
      throw new Error(detail);
    }
    const bookId: string | undefined = fnData?.book?.id;
    if (!bookId) throw new Error(fnData?.error ?? 'ensure_book did not return a book.');

    // 2) Add to the shelf. Unique (user_id, book_id, format) → upsert returns the
    //    existing row instead of duplicating if it's already shelved.
    const totalDuration = format === 'audiobook' ? book.durationMinutes ?? null : null;
    const { data, error } = await supabase
      .from('user_books')
      .upsert(
        { user_id: uid, book_id: bookId, format, total_duration_minutes: totalDuration },
        { onConflict: 'user_id,book_id,format' }
      )
      .select(USER_BOOK_SELECT)
      .single();
    if (error) throw error;
    return mapUserBook(data);
  },

  async updateBookStatus(userBookId: string, status: ReadingStatus, finishedAt?: string | null) {
    const patch: Record<string, any> = { status };
    // Stamp lifecycle timestamps the first time a book enters reading/finished.
    // `finishedAt` lets the caller backdate a book read earlier (else: now).
    if (status === 'reading') patch.started_at = new Date().toISOString();
    if (status === 'finished') patch.finished_at = finishedAt ?? new Date().toISOString();
    const { data, error } = await supabase
      .from('user_books')
      .update(patch)
      .eq('id', userBookId)
      .select(USER_BOOK_SELECT)
      .single();
    if (error) throw error;
    return mapUserBook(data);
  },

  async updateCurrentPage(userBookId: string, page: number) {
    const { error } = await supabase
      .from('user_books')
      .update({ current_page: Math.max(0, Math.round(page)) })
      .eq('id', userBookId);
    if (error) throw error;
  },

  async removeBook(userBookId: string) {
    // RLS (own_userbooks) scopes the delete to the caller's own row. The DB
    // cascades to reading_sessions; reviews keep their book_id (user_book_id → null).
    const { error } = await supabase.from('user_books').delete().eq('id', userBookId);
    if (error) throw error;
  },

  async setFavorite(userBookId: string, isFavorite: boolean) {
    // is_favorite already exists on user_books (B1 schema); owner-scoped by RLS.
    const { data, error } = await supabase
      .from('user_books')
      .update({ is_favorite: isFavorite })
      .eq('id', userBookId)
      .select(USER_BOOK_SELECT)
      .single();
    if (error) throw error;
    return mapUserBook(data);
  },

  // ── Reviews ─────────────────────────────────────────────────────────────────
  async writeReview(bookId: string, rating: number, body?: string, spoiler = false) {
    const uid = await requireUid();
    // reviews.rating is numeric(2,1) — clamp to 0.5 steps in [0.5, 5] so half-stars
    // persist (see 20260614 migration). is_public is forced false for minors by
    // trg_lock_minor_reviews regardless of what we send.
    const safeRating = Math.min(5, Math.max(0.5, Math.round(rating * 2) / 2));
    const { data, error } = await supabase
      .from('reviews')
      .upsert(
        { user_id: uid, book_id: bookId, rating: safeRating, body: body ?? null, contains_spoilers: spoiler, is_public: true },
        { onConflict: 'user_id,book_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    // Attach the author's display name (own row) from public_profiles.
    const { data: prof } = await supabase
      .from('public_profiles')
      .select('display_name, avatar_url')
      .eq('id', uid)
      .maybeSingle();
    return mapReview(data, prof ?? undefined);
  },

  async getMyReviews() {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapReview(r)); // own reviews → no name join needed
  },

  async getReviews(bookId: string) {
    // RLS returns public reviews + the caller's own. Order newest first.
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];
    // Resolve reviewer names in one extra query (can't embed a view via FK).
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const { data: profs } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return rows.map((r) => mapReview(r, byId.get(r.user_id)));
  },
};
