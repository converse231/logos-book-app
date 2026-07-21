// ─────────────────────────────────────────────────────────────────────────────
// Live reading activity — controller SEAM (blueprint §11).
//
// The actual lock-screen presence is NATIVE and lands with the dev build (B5):
//   • iOS     — an ActivityKit Live Activity (a SwiftUI Widget Extension). The
//               widget self-counts elapsed time from `startedAtMs`, so JS only
//               has to start / update(paused, page) / end.
//   • Android — a foreground service with an ongoing (lock-screen) notification.
//
// Until that native module exists, EVERY call here is a safe no-op — it returns
// early in Expo Go and whenever no module is wired — so the session tracker is
// completely unaffected and nothing can break. At the dev build, plug the chosen
// native module into getModule() and these calls light up with ZERO changes to
// the tracker. Mirrors the analytics / notifications seams.
// ─────────────────────────────────────────────────────────────────────────────

import Constants from 'expo-constants';
import ReadingActivity from '@/modules/reading-activity';

export interface LiveActivityStart {
  bookTitle: string;
  coverUrl?: string | null;
  format?: string;
  startedAtMs: number; // native side self-counts elapsed from this
  startPage?: number | null;
  pageCount?: number | null;
}

export interface LiveActivityUpdate {
  paused?: boolean;
  currentPage?: number | null;
}

const isExpoGo = Constants.appOwnership === 'expo';

// Resolves to the native live-activity module on a dev/standalone build where it's
// supported, else null. `ReadingActivity.isSupported` is false in Expo Go (the
// native module isn't present), so every call below stays a safe no-op there.
function getModule(): typeof ReadingActivity | null {
  if (isExpoGo) return null;
  return ReadingActivity.isSupported ? ReadingActivity : null;
}

let active = false;

/** Begin the lock-screen / Dynamic Island activity for a reading session. */
export async function startReadingActivity(info: LiveActivityStart): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    mod.start({
      title: info.bookTitle,
      cover: info.coverUrl,
      format: info.format,
      startedAtMs: info.startedAtMs,
      startPage: info.startPage,
      pageCount: info.pageCount,
    });
    active = true;
  } catch {
    active = false; // never let a live-activity failure disrupt the session
  }
}

/** Push a state change (pause/resume, page progress). No-op if not running. */
export async function updateReadingActivity(patch: LiveActivityUpdate): Promise<void> {
  if (!active) return;
  const mod = getModule();
  if (!mod) return;
  try {
    mod.update({ paused: patch.paused, currentPage: patch.currentPage });
  } catch {
    // ignore — a failed update must never interrupt reading
  }
}

/** End + dismiss the activity. Idempotent and safe to call on unmount. */
export async function endReadingActivity(): Promise<void> {
  if (!active) return;
  const mod = getModule();
  active = false;
  if (!mod) return;
  try {
    mod.end();
  } catch {
    // ignore
  }
}
