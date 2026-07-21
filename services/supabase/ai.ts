// ─────────────────────────────────────────────────────────────────────────────
// B6 — AI recommendations. Thin client over the ai_recommend edge function
// (which holds the Anthropic key + the 7-day cache). No model logic here.
// ─────────────────────────────────────────────────────────────────────────────

import type { QuireApi } from '../api';
import type { AiRecResult } from '../types';
import { supabase } from '@/lib/supabase';

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
  return err?.message ?? 'AI request failed.';
}

export const aiApi: Partial<QuireApi> = {
  async aiRecommend(mood: string, context?: string): Promise<AiRecResult> {
    const { data, error } = await supabase.functions.invoke('ai_recommend', {
      body: { mood, context: context ?? '' },
    });
    if (error) throw new Error(await readEdgeError(error));
    return { recs: data?.recs ?? [], cached: !!data?.cached };
  },
};
