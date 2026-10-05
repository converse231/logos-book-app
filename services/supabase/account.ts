// ─────────────────────────────────────────────────────────────────────────────
// B6 / §21 — account data export + deletion.
//
// exportData reads every owner-scoped table directly (RLS limits each SELECT to
// the caller's own rows) and returns one JSON blob — no edge function needed.
// deleteAccount goes through the service-role delete_account edge fn (removing
// the auth user requires admin), then signs out locally.
// ─────────────────────────────────────────────────────────────────────────────

import type { QuireApi } from '../api';
import { forgetReaderOnDevice, supabase } from '@/lib/supabase';

// Owner-scoped tables included in a data export (RLS returns only the caller's rows).
const EXPORT_TABLES = [
  'users',
  'user_books',
  'reading_sessions',
  'reviews',
  'reading_goals',
  'streaks',
  'comeback_challenges',
  'reading_insights',
  'user_achievements',
  'xp_log',
  // Added in the 2026-09 audit: all owner-scoped, all personal data, and a
  // "download my data" that silently leaves tables out is not one.
  'user_curios',
  'streak_freezes',
  'notification_settings',
  'feedback',
  'review_reports',
  'blocked_users',
] as const;

async function readEdgeError(err: any): Promise<string> {
  const ctx = err?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* not JSON */
    }
  }
  return err?.message ?? 'Request failed.';
}

export const accountApi: Partial<QuireApi> = {
  async exportData(): Promise<string> {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) throw new Error('Not signed in.');

    const out: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userId: uid,
    };
    for (const table of EXPORT_TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw new Error(`Export failed on ${table}: ${error.message}`);
      out[table] = data ?? [];
    }
    return JSON.stringify(out, null, 2);
  },

  async deleteAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete_account', { body: {} });
    if (error) throw new Error(await readEdgeError(error));
    // The auth user is gone, so the server call can only 403 — clear locally.
    await supabase.auth.signOut({ scope: 'local' });
    await forgetReaderOnDevice();
  },
};
