// ─────────────────────────────────────────────────────────────────────────────
// ai_recommend — B6 AI book recommendations (Supabase Edge Function, Deno).
//
// Mood + the reader's own taste (genre_prefs + recent books) → Claude returns a
// structured set of book recs. The Anthropic key lives ONLY here (Supabase
// secret), never in the client. Results cache in ai_rec_cache for 7 days keyed by
// a hash of (mood + context + genres), so a repeated mood is free.
//
// Deploy:  supabase functions deploy ai_recommend
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          (SUPABASE_URL + SUPABASE_ANON_KEY are injected by the platform)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Blueprint/CLAUDE.md specify Sonnet for the AI feature. Swap to claude-opus-4-8
// for higher quality, or claude-haiku-4-5 for lower cost — one line.
const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Structured-output schema — Claude's response is constrained to valid JSON.
// (Structured outputs can't bound array length, so "exactly 5" is in the prompt.)
const SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          author: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['title', 'author', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY is not set on the function.' }, 500);

  // Caller's JWT → all DB reads/writes are RLS-scoped to this user.
  const authHeader = req.headers.get('Authorization') ?? '';
  const db = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
  const uid = user.id;

  let mood = '';
  let context = '';
  try {
    const body = await req.json();
    mood = (body?.mood ?? '').toString().slice(0, 200);
    context = (body?.context ?? '').toString().slice(0, 500);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!mood && !context) return json({ error: 'Provide a mood or some context.' }, 400);

  // Reader taste: onboarding genres + recently-read titles (to bias + exclude).
  const { data: profile } = await db.from('users').select('genre_prefs').eq('id', uid).maybeSingle();
  const genres: string[] = profile?.genre_prefs ?? [];
  // Everything already on ANY shelf (want/reading/finished/dnf) — never re-suggest it.
  const { data: shelfRows } = await db
    .from('user_books')
    .select('book:books(title, authors)')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
    .limit(200);
  const ownedTitles = (shelfRows ?? [])
    .map((r: any) => (r.book?.title ? `${r.book.title}${r.book.authors?.[0] ? ` by ${r.book.authors[0]}` : ''}` : null))
    .filter(Boolean) as string[];

  // Cache key: same mood + taste reuses recs for 7 days (user_id is a separate column).
  const promptHash = await sha256Hex(`${mood}|${context}|${[...genres].sort().join(',')}`);
  const { data: cached } = await db
    .from('ai_rec_cache')
    .select('response_json')
    .eq('user_id', uid)
    .eq('prompt_hash', promptHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (cached?.response_json) {
    return json({ recs: cached.response_json, cached: true });
  }

  // Build the prompt and call Claude with structured output.
  const system =
    'You are a thoughtful book recommender for the LOGOS reading app. Recommend exactly 10 ' +
    'real, published books that match the reader\'s mood and taste. Use correct titles and ' +
    'authors — never invent books. Vary authors and sub-genres so the set feels diverse. ' +
    'The reader already owns the books in the "already on my shelves" list — NEVER recommend any of those. ' +
    'Each "why" is ONE specific, personal sentence under 140 characters explaining the fit.';
  const userPrompt =
    `Mood: ${mood || '(no specific mood — recommend from overall taste)'}\n` +
    (context ? `More context: ${context}\n` : '') +
    (genres.length ? `Favorite genres: ${genres.join(', ')}\n` : '') +
    (ownedTitles.length ? `Already on my shelves (exclude all of these): ${ownedTitles.join('; ')}\n` : '') +
    'Recommend 10 books I do NOT already own.';

  const aiRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system,
      output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'low' },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `Claude API ${aiRes.status}: ${detail.slice(0, 300)}` }, 502);
  }
  const ai = await aiRes.json();
  if (ai.stop_reason === 'refusal') return json({ error: 'The model declined this request.' }, 422);

  const textBlock = (ai.content ?? []).find((b: any) => b.type === 'text');
  let recs: unknown = [];
  try {
    recs = JSON.parse(textBlock?.text ?? '{}').recommendations ?? [];
  } catch {
    return json({ error: 'Could not parse recommendations.' }, 502);
  }

  // Store for 7 days (default expires_at on the column).
  await db.from('ai_rec_cache').upsert(
    { user_id: uid, prompt_hash: promptHash, mood, response_json: recs, model: MODEL },
    { onConflict: 'user_id,prompt_hash' }
  );

  return json({ recs, cached: false });
});
