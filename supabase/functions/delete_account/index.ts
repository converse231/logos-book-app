// ─────────────────────────────────────────────────────────────────────────────
// delete_account — B6 / §21. Permanently deletes the caller's account.
//
// Deleting the auth.users row requires the service role (admin). public.users
// references auth.users(id) ON DELETE CASCADE, and every user-owned table
// references public.users(id) ON DELETE CASCADE — so removing the auth user
// tears down the entire account (books-shelf, sessions, reviews, streaks, …) in
// one shot. Reviews keep their book_id but lose user_book_id (set null).
//
// Deploy: supabase functions deploy delete_account
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY auto-injected.)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  // Service-role delete of the auth user → cascades the whole account.
  const admin = createClient(url, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
