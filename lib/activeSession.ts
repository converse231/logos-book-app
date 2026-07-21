// ─────────────────────────────────────────────────────────────────────────────
// Active-session persistence (crash/kill recovery for the reading tracker).
//
// The tracker's clock is wall-clock based (startedAtMs + paused accounting), but
// the running session itself lives only in memory. If the OS kills the
// backgrounded app — very common while a memory-heavy app like the camera is in
// the foreground — the session would be lost and the timer would appear to reset.
//
// We snapshot the running session (start time, pause accounting, and the book) on
// start and on every pause toggle. On relaunch the tracker rehydrates it and
// recomputes elapsed from the wall clock, so no reading time is lost.
//
// AsyncStorage-backed (already a dependency; works in Expo Go and standalone). The
// snapshot only ever holds ONE live session at a time.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserBook } from '@/services/types';

const KEY = 'logos.activeSession.v1';

export interface ActiveSessionSnapshot {
  sessionBook: UserBook;      // the frozen running book (currentPage = start page)
  startedAtMs: number;        // device clock at session start
  pausedAccumMs: number;      // total ms spent in completed pauses
  pauseStartMs: number | null; // ms-epoch the current pause began, or null
  paused: boolean;
  focusMode: boolean;
  focusMinutes: number;       // chosen focus duration (drives the finish-lock length)
  savedAt: number;            // when this snapshot was written (device clock)
}

export async function saveActiveSession(s: ActiveSessionSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Non-fatal: worst case the session can't be recovered after a kill.
  }
}

export async function loadActiveSession(): Promise<ActiveSessionSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveSessionSnapshot) : null;
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
}
