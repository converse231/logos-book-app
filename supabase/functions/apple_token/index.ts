// ─────────────────────────────────────────────────────────────────────────────
// apple_token — keep the reader's Sign in with Apple refresh token, so that
// delete_account can revoke it (App Store Guideline 5.1.1(v)).
//
// Called by the app right after a successful Apple sign-in with the sheet's
// one-time `authorizationCode`. Trades it for a refresh token and stores it in
// public.apple_refresh_tokens (service-role only).
//
// Best-effort by design: the app never blocks or fails a sign-in on this. Every
// "could not" answers 200 with { stored: false, reason } — it is not an error
// the reader can do anything about. Expected cases:
//   - no Apple secrets yet (no paid developer account): reason "not_configured"
//   - Expo Go: the code is issued to host.exp.Exponent, not our bundle id, so
//     Apple refuses the exchange: reason "exchange_failed"
//
// Deploy: supabase functions deploy apple_token
// Secrets: see ../_shared/apple.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { appleConfig, exchangeAuthorizationCode } from '../_shared/apple.ts';

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

  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authed.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const code = typeof body.authorizationCode === 'string' ? body.authorizationCode.trim() : '';
  // Apple codes are short; anything huge is not one, and is not worth sending on.
  if (!code || code.length > 512) return json({ error: 'authorizationCode is required' }, 400);

  // The caller's own Apple identity. The token is filed only against the account
  // whose Apple user it belongs to — a code from some other Apple ID is refused.
  const appleSub = user.identities?.find((i) => i.provider === 'apple')?.id;
  if (!appleSub) return json({ stored: false, reason: 'not_an_apple_account' });

  const cfg = appleConfig();
  if (!cfg) {
    console.warn('[apple_token] Apple secrets not set — refresh token not stored');
    return json({ stored: false, reason: 'not_configured' });
  }

  let exchanged: { refreshToken: string; sub: string } | null;
  try {
    exchanged = await exchangeAuthorizationCode(cfg, code);
  } catch (e) {
    console.warn('[apple_token]', e instanceof Error ? e.message : e);
    return json({ stored: false, reason: 'exchange_failed' });
  }
  if (!exchanged) return json({ stored: false, reason: 'no_refresh_token' });
  if (exchanged.sub !== appleSub) {
    console.warn('[apple_token] code belongs to a different Apple user — refused');
    return json({ stored: false, reason: 'identity_mismatch' });
  }

  const admin = createClient(url, serviceKey);
  const { error } = await admin.from('apple_refresh_tokens').upsert({
    user_id: user.id,
    refresh_token: exchanged.refreshToken,
    client_id: cfg.clientId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[apple_token] could not store the token', error.message);
    return json({ stored: false, reason: 'store_failed' });
  }
  return json({ stored: true });
});
