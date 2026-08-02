// ─────────────────────────────────────────────────────────────────────────────
// Book search (B3) — client-side catalog lookup, no API key required.
// Primary: Google Books volumes API. Fallback: Open Library search (when Google
// errors or returns nothing). Results map to BookSearchResult (the UI contract);
// addBook re-fetches the full Google volume to build the ensure_book payload.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthorProfile, BookSearchResult } from '@/services/types';

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

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
};

/**
 * Publisher blurbs are HTML often enough to matter: a minority of Google volumes
 * carry `<br>`, `<p>`, `<b>` or entity escapes in `description`, and <Text> renders
 * those literally — a stray "<br>" in the middle of a sentence. Applied where
 * descriptions ENTER the app so every consumer (book page, search rows, and the
 * ensure_book upsert that fills the library detail) gets readable prose. Idempotent,
 * so it's safe to run again at render time on rows stored before this existed.
 */
export function plainText(html?: string | null): string | null {
  if (!html) return null;
  const out = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out.length > 0 ? out : null;
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
    description: plainText(info.description),
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
  plainText(typeof v === 'string' ? v : typeof v?.value === 'string' ? v.value : null);

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

// ─── Author profile + bibliography (the author page) ─────────────────────────

// Open Library bios are user-edited markdown, usually pasted from Wikipedia, and
// arrive with real junk in them: CRLFs, `*emphasis*`, inline `[text](url)` links,
// reference-style `[text][2]` usages, and a block of bare `[2]: https://…`
// definitions dumped at the end. Rendering that raw looks broken, so strip it to
// clean prose. The trailing "Source: …" line is EXTRACTED rather than deleted —
// Wikipedia text is CC BY-SA, so the attribution has to survive somewhere.
function cleanBio(raw: unknown): { bio: string | null; source: { title: string; url: string } | null } {
  const text = typeof raw === 'string' ? raw : typeof (raw as any)?.value === 'string' ? (raw as any).value : null;
  if (!text) return { bio: null, source: null };

  let s = text.replace(/\r\n?/g, '\n');
  // Reference-link definitions on their own lines: `[2]: https://…`
  s = s.replace(/^\[[^\]]+\]:\s*\S+[ \t]*$/gm, '');
  // Pull out the trailing attribution before link syntax is flattened.
  let source: { title: string; url: string } | null = null;
  s = s.replace(/\n*Sources?:\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)[.\s]*$/i, (_m: string, title: string, url: string) => {
    source = { title: title.trim(), url: url.trim() };
    return '';
  });
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');      // [text][2]  → text
  s = s.replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1');   // [text](url) → text
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');             // **bold**   → bold
  s = s.replace(/\*([^*\n]+)\*/g, '$1');               // *italic*   → italic
  s = s.replace(/^#{1,6}\s*/gm, '');                   // headings
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { bio: s.length > 0 ? s : null, source };
}

// top_subjects arrive as comma-packed index facets — "Man-woman relationships,
// fiction", "Fiction, fantasy, epic", "Dublin (Ireland)". Keep only the leading
// facet, drop the parenthetical qualifier, and de-duplicate case-insensitively so
// "Dublin (Ireland)" and "Dublin" collapse. Existing capitalisation is PRESERVED
// (OL already gets "New York Times bestseller" right — sentence-casing wrecks it);
// only an all-lowercase leading character is lifted.
function cleanSubjects(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    if (typeof s !== 'string') continue;
    const head = s.split(',')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (head.length < 3 || head.length > 26) continue;
    const label = head.charAt(0).toUpperCase() + head.slice(1);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length === 6) break;
  }
  return out;
}

// OL link titles are free text and run long ("The Coppermind Wiki - 17th Shard,
// the Official Brandon Sanderson Fansite" is one real value). Chips need a short,
// scannable label, so name the well-known destinations and fall back to the bare
// hostname rather than truncating someone's prose mid-word.
const LINK_LABELS: [RegExp, string][] = [
  [/wikipedia\.org/, 'Wikipedia'],
  [/goodreads\.com/, 'Goodreads'],
  [/amazon\./, 'Amazon'],
  [/(twitter|x)\.com/, 'X'],
  [/instagram\.com/, 'Instagram'],
  [/facebook\.com/, 'Facebook'],
  [/(youtube\.com|youtu\.be)/, 'YouTube'],
  [/substack\.com/, 'Substack'],
];

function linkLabel(title: string, url: string): string {
  for (const [re, label] of LINK_LABELS) if (re.test(url)) return label;
  // Anchored: a fansite titled "…the Official Brandon Sanderson Fansite" is not
  // the official site, and a loose /official/ test labelled both of them the same.
  if (/^official/i.test(title.trim()) || /author'?s website/i.test(title)) return 'Official site';
  const host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return host.length > 0 && host.length <= 24 ? host : title.slice(0, 22);
}

/**
 * Everything the public catalog knows about an author, from Open Library (Google
 * Books has no author records at all). Two calls: the author search index — which
 * carries the counts, ratings, top work and subjects — then the author record for
 * the bio, photo and external links. The second call is skipped for authors OL has
 * only indexed thinly. Returns null only when the author can't be resolved at all.
 */
export async function fetchAuthorProfile(name: string): Promise<AuthorProfile | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=1`);
    if (!res.ok) return null;
    const doc = (await res.json())?.docs?.[0];
    if (!doc?.key) return null;

    const olid: string = doc.key;
    const ratingCount = typeof doc.ratings_count === 'number' ? doc.ratings_count : 0;
    const profile: AuthorProfile = {
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim() : q,
      openLibraryId: olid,
      // `?default=false` 404s instead of serving a placeholder, so <Image onError>
      // can fall back to the monogram.
      photoUrl: `https://covers.openlibrary.org/a/olid/${olid}-M.jpg?default=false`,
      bio: null,
      bioSource: null,
      birthDate: typeof doc.birth_date === 'string' ? doc.birth_date : null,
      deathDate: typeof doc.death_date === 'string' ? doc.death_date : null,
      workCount: typeof doc.work_count === 'number' ? doc.work_count : null,
      topWork: typeof doc.top_work === 'string' ? doc.top_work : null,
      subjects: cleanSubjects(doc.top_subjects),
      // OL reports an average even when nobody has rated — treat 0 ratings as unrated.
      ratingAverage: ratingCount > 0 && typeof doc.ratings_average === 'number' ? doc.ratings_average : null,
      ratingCount,
      readerCount: typeof doc.readinglog_count === 'number' ? doc.readinglog_count : 0,
      links: [],
    };

    // Second call: bio + links. Best-effort — a thin author still gets a page.
    try {
      const ar = await fetch(`https://openlibrary.org/authors/${olid}.json`);
      if (ar.ok) {
        const a = await ar.json();
        const { bio, source } = cleanBio(a.bio);
        profile.bio = bio;
        profile.bioSource = source;
        if (!profile.birthDate && typeof a.birth_date === 'string') profile.birthDate = a.birth_date;
        if (!profile.deathDate && typeof a.death_date === 'string') profile.deathDate = a.death_date;
        if (Array.isArray(a.links)) {
          profile.links = a.links
            .filter((l: any) => typeof l?.url === 'string' && /^https?:\/\//.test(l.url))
            .slice(0, 4)
            .map((l: any) => ({ title: linkLabel(typeof l.title === 'string' ? l.title : '', l.url), url: l.url as string }));
        }
        if (typeof a.wikipedia === 'string' && /^https?:\/\//.test(a.wikipedia)) {
          profile.links.unshift({ title: 'Wikipedia', url: a.wikipedia });
        }
        // The bio's own attribution is a Wikipedia link too — offer it as a chip
        // when OL didn't record one, so "read more about them" always has a home.
        if (profile.bioSource && !profile.links.some((l) => l.url === profile.bioSource!.url)) {
          profile.links.push({ title: linkLabel(profile.bioSource.title, profile.bioSource.url), url: profile.bioSource.url });
        }
        // Two links can still reduce to the same label (two Wikipedia locales, a
        // site plus its /about page). One chip each.
        const byLabel = new Map(profile.links.map((l) => [l.title, l]));
        profile.links = [...byLabel.values()];
      }
    } catch {
      // keep the index-only profile
    }
    return profile;
  } catch {
    return null;
  }
}

// Dedupe key: the work, not the edition. `inauthor:` returns every reissue and
// territory edition, so a Google page for one novelist can be the same four titles
// over and over (the old author screen showed "Normal People" four times). Collapse
// on the title up to any subtitle/parenthetical, punctuation and case stripped.
function workKey(title: string): string {
  return title
    .split(/[:(–—]/)[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // "Café" and "Cafe" must collapse to one key
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** How complete a record is — used to pick the best edition of a duplicated work. */
const richness = (b: BookSearchResult): number =>
  (b.coverUrl ? 4 : 0) + (b.pageCount ? 2 : 0) + (b.description ? 1 : 0);

/**
 * An author's bibliography: one entry per WORK, best edition of each, in Google's
 * relevance order (so the books they're known for lead). Also drops the study
 * guides and "critical companions" that `inauthor:` drags in, by requiring the
 * author's surname to actually appear in the volume's author list.
 */
export async function fetchAuthorBooks(name: string): Promise<BookSearchResult[]> {
  const q = name.trim();
  if (!q) return [];
  let raw: EnsureBookInput[];
  try {
    raw = await googleSearch(`inauthor:"${q}"`, 40);
  } catch {
    try {
      raw = await openLibrarySearch(`author:"${q}"`, 40);
    } catch {
      return [];
    }
  }

  const surname = q.split(/\s+/).pop()!.toLowerCase();
  const best = new Map<string, BookSearchResult>();
  for (const b of raw.map(toSearchResult)) {
    if (!b.title) continue;
    // Books ABOUT the author (study guides, companions) list a different author.
    if (b.authors.length > 0 && !b.authors.some((a) => a.toLowerCase().includes(surname))) continue;
    const key = workKey(b.title);
    if (!key) continue;
    const prev = best.get(key);
    // First-seen wins ties, so Google's relevance order is preserved.
    if (!prev || richness(b) > richness(prev)) best.set(key, b);
  }
  return [...best.values()];
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
