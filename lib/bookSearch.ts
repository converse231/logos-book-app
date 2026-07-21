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

// Optional Google Books API key. Keyless access shares a low daily quota across
// everyone and 429s when exhausted; a (free) key raises it dramatically. Unset =
// keyless (fine for dev, unreliable at scale). Returns the `key` URL param or ''.
const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;
const gbKey = (sep: '?' | '&') => (GOOGLE_BOOKS_KEY ? `${sep}key=${GOOGLE_BOOKS_KEY}` : '');

// Friendly onboarding/category labels → Google Books' BISAC subject taxonomy.
// We keep the nice labels for display/AI/genre_prefs, but `subject:` searches need
// the canonical term or they return thin/empty results (e.g. `subject:Sci-Fi` is
// weak vs `subject:Science Fiction`). Anything not listed passes straight through.
const GENRE_SUBJECT: Record<string, string> = {
  'Sci-Fi': 'Science Fiction',
  'Non-Fiction': 'Nonfiction',
  'Literary Fiction': 'Literary',
  'Historical': 'Historical Fiction',
  'Young Adult': 'Young Adult Fiction',
  'Biography': 'Biography & Autobiography',
  'Business': 'Business & Economics',
};

/** Map a display genre label to a Google Books subject for `subject:` queries. */
export const toSubject = (genre: string): string => GENRE_SUBJECT[genre] ?? genre;

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
    isbn13: b.isbn13 ?? null,
  };
}

const olDesc = (v: any): string | null =>
  typeof v === 'string' ? v : typeof v?.value === 'string' ? v.value : null;

/** Open Library's edition/work records often carry a page count, description, or
 *  subjects that Google omits. When a book about to be added is missing any of
 *  those AND has an ISBN-13, fill the gaps from OL — ONE extra call, only at add
 *  time (never per search result). Best-effort: returns the input unchanged on
 *  any miss/error so adding a book never fails because enrichment did. */
export async function enrichFromOpenLibrary(meta: EnsureBookInput): Promise<EnsureBookInput> {
  const missing = !meta.pageCount || !meta.description || !(meta.genres && meta.genres.length);
  if (!missing || !meta.isbn13) return meta;
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${meta.isbn13}.json`);
    if (!res.ok) return meta;
    const ed = await res.json(); // edition record
    const out: EnsureBookInput = { ...meta };

    if (!out.pageCount && typeof ed.number_of_pages === 'number') out.pageCount = ed.number_of_pages;
    let desc = olDesc(ed.description);
    let subjects: string[] = Array.isArray(ed.subjects) ? ed.subjects : [];

    // Description + subjects usually live on the parent WORK, not the edition.
    if ((!desc || subjects.length === 0) && Array.isArray(ed.works) && ed.works[0]?.key) {
      const wr = await fetch(`https://openlibrary.org${ed.works[0].key}.json`);
      if (wr.ok) {
        const w = await wr.json();
        if (!desc) desc = olDesc(w.description);
        if (subjects.length === 0 && Array.isArray(w.subjects)) subjects = w.subjects;
      }
    }

    if (!out.description && desc) out.description = desc;
    if ((!out.genres || out.genres.length === 0) && subjects.length) out.genres = subjects.slice(0, 5);
    if (!out.publishedYear && typeof ed.publish_date === 'string') out.publishedYear = yearFrom(ed.publish_date);
    return out;
  } catch {
    return meta;
  }
}

async function googleSearch(query: string, max = 20): Promise<EnsureBookInput[]> {
  const u = `${GOOGLE}?q=${encodeURIComponent(query)}&maxResults=${max}&printType=books${gbKey('&')}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(mapGoogleVolume);
}

const OL_FIELDS = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,id_google,isbn';

function mapOlDoc(d: any): EnsureBookInput {
  return {
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
  };
}

async function openLibrarySearch(query: string, max = 20): Promise<EnsureBookInput[]> {
  const res = await fetch(`${OPENLIB}?q=${encodeURIComponent(query)}&limit=${max}&fields=${OL_FIELDS}`);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = await res.json();
  return (data.docs ?? []).map(mapOlDoc);
}

// Open Library's ISBN-keyed search — strong ISBN coverage where Google has gaps.
async function openLibraryByIsbn(isbn: string): Promise<EnsureBookInput[]> {
  const res = await fetch(`${OPENLIB}?isbn=${encodeURIComponent(isbn)}&limit=5&fields=${OL_FIELDS}`);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = await res.json();
  return (data.docs ?? []).map(mapOlDoc);
}

// A scanned barcode / typed code is an ISBN-13 (13 digits) or ISBN-10 (9 digits
// + trailing digit or X). Returns the cleaned ISBN, else null.
function asIsbn(q: string): string | null {
  const clean = q.replace(/[\s-]/g, '');
  return /^\d{13}$/.test(clean) || /^\d{9}[\dXx]$/.test(clean) ? clean : null;
}

/** Search the public catalog. A bare ISBN (e.g. from the scanner) is matched by
 *  ISBN across BOTH providers (Google `isbn:` → Open Library `isbn=`), since
 *  neither alone has complete ISBN coverage. Keyword queries: Google → OL. */
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const isbn = asIsbn(q);

  // Google first (both modes).
  try {
    const g = await googleSearch(isbn ? `isbn:${isbn}` : q);
    if (g.length > 0) return g.map(toSearchResult);
  } catch {
    // fall through
  }
  // Open Library fallback — ISBN-keyed for a scan, keyword otherwise.
  try {
    const ol = isbn ? await openLibraryByIsbn(isbn) : await openLibrarySearch(q);
    return ol.map(toSearchResult);
  } catch {
    return [];
  }
}

/** Author headshot from Open Library (Google Books has none). Resolves the
 *  author's OLID, then the medium cover. `?default=false` → 404 when no photo
 *  exists, so the caller can fall back to an initial. Null if not found. */
export async function fetchAuthorPhoto(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const key = data.docs?.[0]?.key;
    return key ? `https://covers.openlibrary.org/a/olid/${key}-M.jpg?default=false` : null;
  } catch {
    return null;
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
 *  by addBook (the QuireApi only hands us the id). Handles the `ol:` prefix that
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
    const res = await fetch(`${GOOGLE}/${encodeURIComponent(id)}${gbKey('?')}`);
    if (!res.ok) return null;
    return mapGoogleVolume(await res.json());
  } catch {
    return null;
  }
}
