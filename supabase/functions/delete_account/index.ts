// ─────────────────────────────────────────────────────────────────────────────
// delete_account — B6 / §21. Permanently deletes the caller's account.
//
// Deleting the auth.users row requires the service role (admin). public.users
// references auth.users(id) ON DELETE CASCADE, and every user-owned table
// references public.users(id) ON DELETE CASCADE — so removing the auth user
// tears down the entire account (books-shelf, sessions, reviews, streaks, …) in
// one shot. Reviews keep their book_id but lose user_book_id (set null).
//
// Sign in with Apple (Guideline 5.1.1(v)): if the reader ever signed in with
// Apple, their Apple refresh token (stored by apple_token) is revoked with Apple
// before the account goes, which also removes Quire from their Apple ID's
// "Sign in with Apple" list. Best-effort: Apple being unreachable is logged but
// never blocks the deletion — a reader must always be able to delete.
//
// Deploy: supabase functions deploy delete_account
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY auto-injected;
// Apple secrets optional, see ../_shared/apple.ts.)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { appleConfig, revokeRefreshToken } from '../_shared/apple.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their JWT — you can only delete your OWN account.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(url, serviceKey);

  // Storage is outside the FK cascade. The avatar lives in a PUBLIC bucket, so
  // without this a "deleted" reader's photo stayed reachable at its URL forever.
  // Done first: if it fails we stop, rather than orphaning a file we can no
  // longer attribute to anyone.
  const { data: files, error: listErr } = await admin.storage.from('avatars').list(user.id);
  if (listErr) return json({ error: `Could not clear your files: ${listErr.message}` }, 500);
  if (files && files.length) {
    const { error: rmErr } = await admin.storage
      .from('avatars')
      .remove(files.map((f) => `${user.id}/${f.name}`));
    if (rmErr) return json({ error: `Could not clear your files: ${rmErr.message}` }, 500);
  }

  // Revoke Apple BEFORE deleting: the token row cascades away with the user.
  const { data: apple, error: appleErr } = await admin
    .from('apple_refresh_tokens')
    .select('refresh_token, client_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (appleErr) console.warn('[delete_account] could not read Apple token', appleErr.message);
  if (apple) {
    const cfg = appleConfig();
    if (!cfg) {
      console.warn('[delete_account] Apple token present but Apple secrets not set — not revoked');
    } else {
      try {
        await revokeRefreshToken(cfg, apple.refresh_token, apple.client_id);
      } catch (e) {
        console.warn('[delete_account] Apple revoke failed', e instanceof Error ? e.message : e);
      }
    }
  } else if (user.identities?.some((i) => i.provider === 'apple')) {
    // Signed in with Apple but nothing stored (Expo Go, or before secrets were set).
    console.warn('[delete_account] Apple account with no stored token — nothing to revoke');
  }

  // Service-role delete of the auth user → cascades the whole account.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
