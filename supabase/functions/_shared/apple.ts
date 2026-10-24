// ─────────────────────────────────────────────────────────────────────────────
// Sign in with Apple — server-side token exchange and revocation.
//
// Used by `apple_token` (sign-in: authorization code → refresh token) and
// `delete_account` (revoke that refresh token). Both need a "client secret": a
// short-lived ES256 JWT signed with the Sign in with Apple private key (.p8).
//
// Secrets (supabase secrets set …) — all four come from the Apple Developer
// account, so until it exists `appleConfig()` returns null and both callers
// degrade to a logged no-op instead of failing sign-in or account deletion:
//   APPLE_TEAM_ID       Membership → Team ID
//   APPLE_KEY_ID        Keys → the Sign in with Apple key's ID
//   APPLE_PRIVATE_KEY   that key's .p8 contents (PEM; literal "\n" is accepted)
//   APPLE_CLIENT_ID     optional, defaults to the bundle id com.quire.app
// ─────────────────────────────────────────────────────────────────────────────

import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

const APPLE = 'https://appleid.apple.com';

export interface AppleConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
}

export function appleConfig(): AppleConfig | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey, clientId: Deno.env.get('APPLE_CLIENT_ID') ?? 'com.quire.app' };
}

// Apple accepts up to 6 months; five minutes is all a single call needs, and a
// leaked secret is then worthless almost immediately.
async function clientSecret(cfg: AppleConfig, clientId: string): Promise<string> {
  const key = await importPKCS8(cfg.privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience(APPLE)
    .setSubject(clientId)
    .sign(key);
}

async function postForm(path: string, form: Record<string, string>): Promise<Response> {
  return await fetch(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
}

/** Trade the one-time authorization code from the sign-in sheet (valid ~5 min)
 *  for a long-lived refresh token, plus the Apple user id (`sub`) it belongs to
 *  — read from the id_token in the same response. That token came straight from
 *  Apple over TLS in reply to our signed request, so its payload is trusted
 *  without re-verifying the signature. */
export async function exchangeAuthorizationCode(
  cfg: AppleConfig,
  code: string,
): Promise<{ refreshToken: string; sub: string } | null> {
  const res = await postForm('/auth/token', {
    client_id: cfg.clientId,
    client_secret: await clientSecret(cfg, cfg.clientId),
    code,
    grant_type: 'authorization_code',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant is expected for codes issued to another client — Expo Go's
    // sheet issues them to host.exp.Exponent, which we cannot sign for.
    throw new Error(`Apple token exchange failed (${res.status}): ${body.error ?? 'unknown'}`);
  }
  if (typeof body.refresh_token !== 'string' || typeof body.id_token !== 'string') return null;
  const sub = idTokenSubject(body.id_token);
  return sub ? { refreshToken: body.refresh_token, sub } : null;
}

function idTokenSubject(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null; // not a JWT — treated as "no token", never as a match
  }
}

/** Revoke a refresh token. Apple answers 200 for a token that is already
 *  revoked or unknown too, so a retry is harmless. */
export async function revokeRefreshToken(cfg: AppleConfig, token: string, clientId: string): Promise<void> {
  const res = await postForm('/auth/revoke', {
    client_id: clientId,
    client_secret: await clientSecret(cfg, clientId),
    token,
    token_type_hint: 'refresh_token',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Apple revoke failed (${res.status}): ${body.error ?? 'unknown'}`);
  }
}
