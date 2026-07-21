// ─────────────────────────────────────────────────────────────────────────────
// reading-activity — JS surface for the native live reading-session timer.
//
//   • iOS     → an ActivityKit Live Activity (Lock Screen + Dynamic Island)
//   • Android → a foreground-service ongoing notification with a chronometer
//
// Both the native widgets SELF-COUNT elapsed time from `startedAtMs`, so JS only
// ever calls start / update(paused, page) / end — never a per-second tick.
//
// `requireOptionalNativeModule` returns null in Expo Go and in any build that
// doesn't include the native module, so importing this file is always safe — the
// exported functions simply no-op there. The tracker reaches this only through
// `lib/liveActivity.ts`, which additionally guards on Expo Go.
// ─────────────────────────────────────────────────────────────────────────────

import { requireOptionalNativeModule } from 'expo-modules-core';

export interface ReadingActivityStartConfig {
  title: string;
  cover?: string | null;
  format?: string;
  startedAtMs: number; // device clock at session start — the native side counts from this
  startPage?: number | null;
  pageCount?: number | null;
}

export interface ReadingActivityUpdate {
  paused?: boolean;
  currentPage?: number | null;
}

interface NativeReadingActivity {
  isSupported(): boolean;
  start(config: ReadingActivityStartConfig): void;
  update(patch: ReadingActivityUpdate): void;
  end(): void;
}

const Native = requireOptionalNativeModule<NativeReadingActivity>('ReadingActivity');

/** True only on a dev/standalone build that includes the native module AND where
 *  the OS supports the live timer (iOS: Live Activities enabled by the user;
 *  Android: always). False in Expo Go. */
export const isSupported: boolean = !!Native && (Native.isSupported?.() ?? true);

export function start(config: ReadingActivityStartConfig): void {
  Native?.start(config);
}

export function update(patch: ReadingActivityUpdate): void {
  Native?.update(patch);
}

export function end(): void {
  Native?.end();
}

export default { isSupported, start, update, end };
