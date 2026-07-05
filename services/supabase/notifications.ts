// ─────────────────────────────────────────────────────────────────────────────
// B5 — notification preferences + push-token registration.
// notification_settings (one row per user, auto-created on signup by a trigger,
// owner-scoped by RLS) drives which pushes the server sends. The Expo push token
// lives on users.expo_push_token and is what send_push targets.
// ─────────────────────────────────────────────────────────────────────────────

import type { LogosApi } from '../api';
import type { NotificationSettings } from '../types';
import { supabase } from '@/lib/supabase';

function mapSettings(r: any): NotificationSettings {
  return {
    enabled: r.enabled ?? true,
    dailyReminder: r.daily_reminder ?? true,
    dailyReminderHour: r.daily_reminder_hour ?? 20,
    atRiskAlerts: r.at_risk_alerts ?? true,
    weeklyDigest: r.weekly_digest ?? true,
    comebackAlerts: r.comeback_alerts ?? true,
    socialAlerts: r.social_alerts ?? true,
    insightAlerts: r.insight_alerts ?? true,
    quietHoursStart: r.quiet_hours_start ?? null,
    quietHoursEnd: r.quiet_hours_end ?? null,
  };
}

// camelCase patch → snake_case columns (only the keys present).
function toColumns(p: Partial<NotificationSettings>): Record<string, any> {
  const c: Record<string, any> = {};
  if (p.enabled !== undefined) c.enabled = p.enabled;
  if (p.dailyReminder !== undefined) c.daily_reminder = p.dailyReminder;
  if (p.dailyReminderHour !== undefined) c.daily_reminder_hour = p.dailyReminderHour;
  if (p.atRiskAlerts !== undefined) c.at_risk_alerts = p.atRiskAlerts;
  if (p.weeklyDigest !== undefined) c.weekly_digest = p.weeklyDigest;
  if (p.comebackAlerts !== undefined) c.comeback_alerts = p.comebackAlerts;
  if (p.socialAlerts !== undefined) c.social_alerts = p.socialAlerts;
  if (p.insightAlerts !== undefined) c.insight_alerts = p.insightAlerts;
  if (p.quietHoursStart !== undefined) c.quiet_hours_start = p.quietHoursStart;
  if (p.quietHoursEnd !== undefined) c.quiet_hours_end = p.quietHoursEnd;
  return c;
}

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Not signed in.');
  return uid;
}

export const notificationApi: Partial<LogosApi> = {
  async getNotificationSettings() {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    // The signup trigger seeds a row, but fall back to defaults if it's missing.
    return data ? mapSettings(data) : mapSettings({});
  },

  async updateNotificationSettings(patch) {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: uid, ...toColumns(patch) }, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapSettings(data);
  },

  async registerPushToken(token: string) {
    const uid = await requireUid();
    const { error } = await supabase.from('users').update({ expo_push_token: token }).eq('id', uid);
    if (error) throw error;
  },
};
