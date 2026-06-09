// ─────────────────────────────────────────────────────────────────────────────
// ensure_book — B3 catalog upsert (Supabase Edge Function, Deno).
//
// public.books is world-READABLE but service-role WRITE-ONLY (RLS: no client
// insert). So adding a book to a shelf can't insert the catalog row directly.
// The client sends normalized book metadata here; this function verifies the
// caller is authenticated, then upserts the catalog row with the service role
// and returns it (id + fields). Idempotent on google_books_id (unique).
//
// Deploy:  supabase functions deploy ensure_book
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically
//          by the platform — no manual secret needed.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BookInput {
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Verify the caller is a signed-in user (don't let anonymous traffic spam
  //    the shared catalog). Uses the caller's JWT from the Authorization header.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // 2) Parse + minimally validate input.
  let input: BookInput;
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!input?.title || typeof input.title !== 'string') {
    return json({ error: 'title is required' }, 400);
  }
  if (!input.googleBooksId && !input.openLibraryId && !input.isbn13) {
    return json({ error: 'one of googleBooksId / openLibraryId / isbn13 is required' }, 400);
  }

  // 3) Service-role client for the privileged catalog write.
  const admin = createClient(url, serviceKey);

  const row = {
    google_books_id: input.googleBooksId ?? null,
    open_library_id: input.openLibraryId ?? null,
    isbn_13: input.isbn13 ?? null,
    title: input.title,
    subtitle: input.subtitle ?? null,
    authors: input.authors ?? [],
    cover_url: input.coverUrl ?? null,
    page_count: input.pageCount ?? null,
    duration_minutes: input.durationMinutes ?? null,
    published_year: input.publishedYear ?? null,
    publisher: input.publisher ?? null,
    description: input.description ?? null,
    genres: input.genres ?? [],
    language: input.language ?? 'en',
  };

  // Dedupe on google_books_id when present (it's the unique key). If the book
  // already exists, return it instead of creating a duplicate.
  if (row.google_books_id) {
    const { data: existing } = await admin
      .from('books')
      .select('*')
      .eq('google_books_id', row.google_books_id)
      .maybeSingle();
    if (existing) return json({ book: existing });
  }

  const { data, error } = await admin.from('books').insert(row).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ book: data });
});
