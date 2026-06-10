// ─────────────────────────────────────────────────────────────────────────────
// Analytics seam (B6 / blueprint §18). Thin wrapper over PostHog so call sites
// stay decoupled. If EXPO_PUBLIC_POSTHOG_KEY is unset, every call is a silent
// no-op (so the app runs fine with analytics disabled, e.g. before you add a key).
// distinct_id = the Supabase user_id (set via identifyUser on auth changes).
// ─────────────────────────────────────────────────────────────────────────────

import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

export function initAnalytics() {
  if (client) return;
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return; // analytics disabled — no key configured
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  try {
    client = new PostHog(apiKey, { host });
  } catch {
    client = null;
  }
}

export function identifyUser(userId: string) {
  try {
    client?.identify(userId);
  } catch {
    /* never let analytics break a flow */
  }
}

export function track(event: string, props?: Record<string, any>) {
  try {
    client?.capture(event, props);
  } catch {
    /* swallow */
  }
}

export function resetAnalytics() {
  try {
    client?.reset();
  } catch {
    /* swallow */
  }
}
