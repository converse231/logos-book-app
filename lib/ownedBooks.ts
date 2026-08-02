// Matching catalog results against the reader's shelf.
//
// A search result and a shelved book rarely share an id: the shelf row was created
// from whichever provider served it that day (Google or Open Library), so the same
// novel can arrive as a different googleBooksId, or with no id in common at all.
// Every surface that shows catalog books next to owned ones — add-book rows, the
// author bibliography, the book page — needs the same three-way match, so it lives
// here once instead of being re-derived (slightly differently) per screen.

import type { BookSearchResult, UserBook } from '@/services/types';

/** Title + first author, punctuation and case stripped — the fallback identity
 *  when neither provider id nor ISBN is shared. */
export const normKey = (title: string, authors: string[]): string =>
  `${title}|${authors[0] ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');

export type OwnedLookup = Map<string, UserBook>;

/** Index a shelf by every key a catalog result might match on. */
export function buildOwnedLookup(books: UserBook[]): OwnedLookup {
  const m: OwnedLookup = new Map();
  for (const ub of books) {
    if (ub.book.googleBooksId) m.set(`g:${ub.book.googleBooksId}`, ub);
    if (ub.book.isbn13) m.set(`i:${ub.book.isbn13}`, ub);
    m.set(`t:${normKey(ub.book.title, ub.book.authors)}`, ub);
  }
  return m;
}

/** The shelf row for a catalog result, if the reader already has it. Id first,
 *  then ISBN, then title+author — most specific match wins. */
export function findOwned(lookup: OwnedLookup, r: BookSearchResult): UserBook | undefined {
  return (
    (r.googleBooksId ? lookup.get(`g:${r.googleBooksId}`) : undefined) ??
    (r.isbn13 ? lookup.get(`i:${r.isbn13}`) : undefined) ??
    lookup.get(`t:${normKey(r.title, r.authors)}`)
  );
}
