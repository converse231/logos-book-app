// ─────────────────────────────────────────────────────────────────────────────
// Feedback — tester feedback + bug reports written to public.feedback (RLS:
// owner-scoped insert/select). The app version + platform are attached
// automatically so bug reports carry enough context to act on.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { LogosApi } from '../api';
import { supabase } from '@/lib/supabase';

function platformTag(): string {
  const os = Device.osName ?? Platform.OS;
  const ver = Device.osVersion ?? String(Platform.Version ?? '');
  const model = Device.modelName ? ` · ${Device.modelName}` : '';
  return `${os} ${ver}${model}`.trim();
}

export const feedbackApi: Partial<LogosApi> = {
  async submitFeedback({ kind, message }): Promise<void> {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) throw new Error('Not signed in.');

    const { error } = await supabase.from('feedback').insert({
      user_id: uid,
      kind,
      message: message.trim(),
      app_version: Constants.expoConfig?.version ?? null,
      platform: platformTag(),
    });
    if (error) throw error;
  },
};
