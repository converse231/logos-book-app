// ─────────────────────────────────────────────────────────────────────────────
// Book search (B3) — client-side catalog lookup, no API key required.
// Primary: Google Books volumes API. Fallback: Open Library search (when Google
// errors or returns nothing). Results map to BookSearchResult (the UI contract);
// addBook re-fetches the full Google volume to build the ensure_book payload.
// ─────────────────────────────────────────────────────────────────────────────

import type { BookSearchResult } from '@/services/types';

// Payload shape ensure_book expects (superset of BookSearchResult).
export interface EnsureBookInput {
  googleBooksId?: string | null;
  openLibraryId?: string | null;
  isbn13?: string | null;
  title: string;
  subtitle?: string | null;
  authors?: string[];
  coverUrl?: string | null;
  pageCount?: number | null;
  durationMinutes?: number | null;
  publishedYear?: number | null;
  publisher?: string | null;
  description?: string | null;
  genres?: string[];
  language?: string | null;
}

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPENLIB = 'https://openlibrary.org/search.json';

function yearFrom(date?: string | null): number | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

// Google cover URLs come back as http with curl edges; normalize to https.
function httpsCover(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:/, 'https:');
}

function mapGoogleVolume(v: any): EnsureBookInput {
  const info = v.volumeInfo ?? {};
  const ids: any[] = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  return {
    googleBooksId: v.id,
    isbn13,
    title: info.title ?? 'Untitled',
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    coverUrl: httpsCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
    durationMinutes: null, // Google Books has no audiobook duration
    publishedYear: yearFrom(info.publishedDate),
    publisher: info.publisher ?? null,
    description: info.description ?? null,
    genres: info.categories ?? [],
    language: info.language ?? 'en',
  };
}

function toSearchResult(b: EnsureBookInput): BookSearchResult {
  return {
    googleBooksId: b.googleBooksId ?? (b.openLibraryId ? `ol:${b.openLibraryId}` : ''),
    title: b.title,
    authors: b.authors ?? [],
    coverUrl: b.coverUrl ?? null,
    pageCount: b.pageCount ?? null,
    durationMinutes: b.durationMinutes ?? null,
    publishedYear: b.publishedYear ?? null,
    genres: b.genres ?? [],
    description: b.description ?? null,
  };
}

async function googleSearch(query: string, max = 20): Promise<EnsureBookInput[]> {
  const u = `${GOOGLE}?q=${encodeURIComponent(query)}&maxResults=${max}&printType=books`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(mapGoogleVolume);
}

async function openLibrarySearch(query: string, max = 20): Promise<EnsureBookInput[]> {
  const fields = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,id_google,isbn';
  const u = `${OPENLIB}?q=${encodeURIComponent(query)}&limit=${max}&fields=${fields}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = await res.json();
  return (data.docs ?? []).map((d: any) => ({
    googleBooksId: Array.isArray(d.id_google) ? d.id_google[0] : null,
    openLibraryId: typeof d.key === 'string' ? d.key.replace('/works/', '') : null,
    isbn13: Array.isArray(d.isbn) ? d.isbn.find((s: string) => s.length === 13) ?? null : null,
    title: d.title ?? 'Untitled',
    authors: d.author_name ?? [],
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    pageCount: typeof d.number_of_pages_median === 'number' ? d.number_of_pages_median : null,
    durationMinutes: null,
    publishedYear: typeof d.first_publish_year === 'number' ? d.first_publish_year : null,
    genres: Array.isArray(d.subject) ? d.subject.slice(0, 5) : [],
    description: null,
  }));
}

/** Search the public catalog. Google Books first; Open Library on failure. */
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const g = await googleSearch(q);
    if (g.length > 0) return g.map(toSearchResult);
  } catch {
    // fall through to Open Library
  }
  try {
    return (await openLibrarySearch(q)).map(toSearchResult);
  } catch {
    return [];
  }
}

/** A "popular right now" set for the add-book empty state (before any query). */
export async function recommendedBooks(): Promise<BookSearchResult[]> {
  try {
    return (await googleSearch('subject:fiction bestseller', 12)).map(toSearchResult);
  } catch {
    return [];
  }
}

/** Full metadata for a single Google volume — built into the ensure_book payload
 *  by addBook (the LogosApi only hands us the id). Handles the `ol:` prefix that
 *  toSearchResult assigns to Open-Library-only results. */
export async function fetchBookForId(id: string): Promise<EnsureBookInput | null> {
  if (id.startsWith('ol:')) {
    // Open-Library-only result: re-run a search by its key isn't reliable, so
    // pull the work record for title/authors and store the OL id.
    const key = id.slice(3);
    try {
      const res = await fetch(`https://openlibrary.org/works/${key}.json`);
      if (!res.ok) return null;
      const w = await res.json();
      return {
        openLibraryId: key,
        title: w.title ?? 'Untitled',
        authors: [],
        coverUrl: Array.isArray(w.covers) && w.covers[0]
          ? `https://covers.openlibrary.org/b/id/${w.covers[0]}-L.jpg`
          : null,
        description: typeof w.description === 'string' ? w.description : w.description?.value ?? null,
        genres: Array.isArray(w.subjects) ? w.subjects.slice(0, 5) : [],
      };
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(`${GOOGLE}/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return mapGoogleVolume(await res.json());
  } catch {
    return null;
  }
}
