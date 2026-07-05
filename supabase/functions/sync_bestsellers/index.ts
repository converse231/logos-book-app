// ─────────────────────────────────────────────────────────────────────────────
// sync_bestsellers — B6 NYT bestseller refresh (Supabase Edge Function, Deno).
//
// Fetches the current NYT bestseller lists (the API key lives ONLY here as a
// secret) and upserts them into public.bestseller_lists with the service role.
// The client never calls NYT directly — it reads the cached table. Invoked
// WEEKLY by pg_cron (fn_sync_bestsellers → pg_net), or manually for a first fill.
//
// Auth: callers must send `x-sync-secret: <BESTSELLERS_SYNC_SECRET>` so random
// anon traffic can't burn the NYT quota. (NYT free tier ≈ 5 req/min, 500/day.)
//
// Deploy:  supabase functions deploy sync_bestsellers --no-verify-jwt
// Secrets: supabase secrets set NYT_API_KEY=...
//          supabase secrets set BESTSELLERS_SYNC_SECRET=...   (any long random string)
//          SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Manual test (PowerShell):
//   Invoke-RestMethod -Method Post `
//     -Uri "https://<ref>.supabase.co/functions/v1/sync_bestsellers" `
//     -Headers @{ "x-sync-secret" = "<your secret>" }
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';

// The lists we surface in Discover. Add more NYT encoded names here to expand.
const LISTS = ['hardcover-fiction', 'hardcover-nonfiction'];
const NYT_BASE = 'https://api.nytimes.com/svc/books/v3/lists/current';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// NYT returns SHOUTING titles ("THE WOMEN"); render them Title Case for the UI.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/(^|\s)(A|An|And|The|Of|Or|In|On|To|For)\b/g, (m) => m.toLowerCase())
    .replace(/^([a-z])/, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('BESTSELLERS_SYNC_SECRET');
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const nytKey = Deno.env.get('NYT_API_KEY');
  if (!nytKey) return json({ error: 'NYT_API_KEY is not set on the function.' }, 500);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const summary: Record<string, number | string> = {};

  for (let i = 0; i < LISTS.length; i++) {
    const list = LISTS[i];
    // Be polite to the NYT rate limit between lists.
    if (i > 0) await sleep(1500);

    const res = await fetch(`${NYT_BASE}/${list}.json?api-key=${nytKey}`);
    if (!res.ok) {
      summary[list] = `NYT ${res.status}`;
      continue;
    }
    const payload = await res.json();
    const results = payload?.results;
    const books: any[] = results?.books ?? [];
    if (books.length === 0) {
      summary[list] = 0;
      continue;
    }

    const listName: string = results.list_name_encoded ?? list;
    const listDisplay: string = results.display_name ?? titleCase(list.replace(/-/g, ' '));
    const listUpdated: string | null = results.bestsellers_date ?? null;

    const rows = books.map((b) => ({
      list_name: listName,
      list_display: listDisplay,
      rank: b.rank,
      title: titleCase(b.title ?? 'Untitled'),
      author: b.author ?? null,
      isbn_13: b.primary_isbn13 ?? null,
      cover_url: b.book_image ?? null,
      description: b.description ?? null,
      publisher: b.publisher ?? null,
      weeks_on_list: b.weeks_on_list ?? 0,
      amazon_url: b.amazon_product_url ?? null,
      list_updated: listUpdated,
    }));

    // Replace the whole list: clear stale ranks, then insert the fresh top N.
    await admin.from('bestseller_lists').delete().eq('list_name', listName);
    const { error } = await admin.from('bestseller_lists').insert(rows);
    summary[listName] = error ? `insert error: ${error.message}` : rows.length;
  }

  return json({ ok: true, synced: summary });
});
