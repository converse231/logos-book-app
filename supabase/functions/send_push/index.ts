// ─────────────────────────────────────────────────────────────────────────────
// send_push — B5 push delivery (Supabase Edge Function, Deno). Blueprint §16.
//
// Called by the streak/reminder cron jobs (via pg_net) with a set of user ids, a
// notification type, and template vars. It pulls each user's push token +
// level_name (FRESH at send time, so the identity is current even if they leveled
// up after scheduling), respects notification_settings toggles, renders the
// template, and posts to the Expo Push API in batches.
//
// Auth: callers must send `x-push-secret: <PUSH_SEND_SECRET>` (cron passes it).
//
// Deploy:  supabase functions deploy send_push --no-verify-jwt
// Secrets: supabase secrets set PUSH_SEND_SECRET=<long random string>
//          SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Body: { "userIds": ["..."], "type": "at_risk", "vars": { "N": 12, "X": 3 } }
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Vars = Record<string, string | number>;

// Body templates (§16.1). [LevelName] is always available; other tokens come from `vars`.
const TEMPLATES: Record<string, (lvl: string, v: Vars) => string> = {
  at_risk: (lvl, v) => `${lvl} — your ${v.N}-day streak ends in ${v.X} hours`,
  streak_broken: (lvl, v) => `${lvl} — your ${v.N}-day streak ended. Start your comeback now →`,
  comeback_challenge_created: (lvl, v) => `${lvl} — ${v.N}-day streak ended. Complete 3 sessions in 3 days to restore it →`,
  comeback_challenge_progress: (lvl, v) => `${lvl} — ${v.k}/3 sessions done. ${v.d} days left to restore your streak.`,
  comeback_challenge_expired: () => `Your comeback window closed. Start fresh — every streak begins with session 1.`,
  comeback_restored: (lvl, v) => `${lvl} — your ${v.N}-day streak is BACK 🔥`,
  daily_reminder: (lvl, v) => `${lvl} — ${v.BookTitle ?? 'your book'} is waiting on page ${v.N ?? 1}.`,
  weekly_digest: (lvl, v) => `${lvl} — this week: ${v.P} pages, ${v.S} sessions. ${v.BestStat ?? ''} 🔥`,
  goal_milestone: (lvl, v) => `${lvl} — you're halfway to your ${v.N}-book goal.`,
  almost_there: (lvl, v) => `${lvl} — ${v.N} days to ${v.BadgeName} badge 🎯`,
  reading_insight: (lvl) => `${lvl} — you've unlocked a personal reading insight 💡`,
  long_absence_3d: (lvl, v) => `${lvl} — it's been 3 days. ${v.BookTitle ?? 'your book'} is waiting on page ${v.N ?? 1}.`,
};

// Per-type deep link (§16) + the notification_settings column that gates it.
const DEEP_LINK: Record<string, string> = {
  at_risk: 'quire://home',
  streak_broken: 'quire://comeback',
  comeback_challenge_created: 'quire://comeback',
  comeback_challenge_progress: 'quire://comeback',
  comeback_challenge_expired: 'quire://home',
  comeback_restored: 'quire://home',
  daily_reminder: 'quire://home',
  weekly_digest: 'quire://stats',
  goal_milestone: 'quire://home',
  almost_there: 'quire://home',
  reading_insight: 'quire://insights',
  long_absence_3d: 'quire://home',
};

// Which notification_settings boolean must be true for each type (besides `enabled`).
const GATE: Record<string, string | null> = {
  at_risk: 'at_risk_alerts',
  streak_broken: 'comeback_alerts',
  comeback_challenge_created: 'comeback_alerts',
  comeback_challenge_progress: 'comeback_alerts',
  comeback_challenge_expired: 'comeback_alerts',
  comeback_restored: 'comeback_alerts',
  daily_reminder: 'daily_reminder',
  weekly_digest: 'weekly_digest',
  goal_milestone: null,
  almost_there: null,
  reading_insight: 'insight_alerts',
  long_absence_3d: null,
};

async function postBatches(messages: any[]) {
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('PUSH_SEND_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  let userIds: string[] = [];
  let type = '';
  let vars: Vars = {};
  try {
    const body = await req.json();
    userIds = Array.isArray(body?.userIds) ? body.userIds : [];
    type = String(body?.type ?? '');
    vars = body?.vars ?? {};
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const template = TEMPLATES[type];
  if (!template) return json({ error: `Unknown notification type: ${type}` }, 400);
  if (userIds.length === 0) return json({ ok: true, sent: 0, note: 'no userIds' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  // Pull token + fresh level_name, joined to each user's settings.
  const { data: users, error } = await admin
    .from('users')
    .select('id, expo_push_token, level_name, notification_settings(*)')
    .in('id', userIds)
    .not('expo_push_token', 'is', null);
  if (error) return json({ error: error.message }, 500);

  const gateCol = GATE[type];
  const messages: any[] = [];
  for (const u of users ?? []) {
    const s: any = Array.isArray((u as any).notification_settings)
      ? (u as any).notification_settings[0]
      : (u as any).notification_settings;
    if (s && s.enabled === false) continue;                 // master off
    if (s && gateCol && s[gateCol] === false) continue;     // this type off
    const body = template(u.level_name ?? 'Reader', vars);
    messages.push({
      to: u.expo_push_token,
      title: 'Quire',
      body,
      sound: 'default',
      data: { deepLink: DEEP_LINK[type] ?? 'quire://home', type },
    });
  }

  const sent = await postBatches(messages);
  return json({ ok: true, sent, candidates: messages.length });
});
