// ─────────────────────────────────────────────────────────────────────────────
// Offline session queue (blueprint §8). A reading session is captured with a
// FROZEN local_date + a client_uuid at finish time. If completeSession can't
// reach the server (offline / transient error), the session is persisted here
// and drained later — so a session is never lost, and the streak lands on the
// day it was read.
//
// Backed by AsyncStorage (already a dependency, works in Expo Go and standalone
// builds — no native module). complete_session is idempotent on client_uuid, so
// re-sending a session that actually succeeded server-side is safe (it dedupes).
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LogosApi } from '@/services/api';
import type { CompleteSessionResult, QueuedSession } from '@/services/types';

const KEY = 'logos.sessionQueue.v1';
const MAX_ATTEMPTS = 8; // drop after this many failed sends (matches §8 guidance)

async function readQueue(): Promise<QueuedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedSession[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage failure is non-fatal — worst case the session isn't persisted
  }
}

/** How many sessions are waiting to sync (for a subtle UI badge if wanted). */
export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Persist a session that couldn't be sent now. Deduped by client_uuid. */
export async function enqueueSession(session: QueuedSession): Promise<void> {
  const q = await readQueue();
  if (q.some((s) => s.clientUuid === session.clientUuid)) return;
  q.push(session);
  await writeQueue(q);
}

/** Online finish path: try to send; on failure, queue it. Returns the server
 *  result when it went through immediately, or null when it was queued. */
export async function sendOrQueue(
  api: LogosApi,
  session: QueuedSession
): Promise<CompleteSessionResult | null> {
  try {
    return await api.completeSession(session);
  } catch {
    await enqueueSession(session);
    return null;
  }
}

let draining = false;

/** Try to flush every queued session. Safe to call often (re-entrancy guarded).
 *  Successful + permanently-failed (max attempts) items are removed; transient
 *  failures stay with an incremented attempt count. Returns how many synced. */
export async function drainQueue(api: LogosApi): Promise<number> {
  if (draining) return 0;
  draining = true;
  try {
    let q = await readQueue();
    if (q.length === 0) return 0;

    const survivors: QueuedSession[] = [];
    let synced = 0;
    for (const s of q) {
      try {
        await api.completeSession(s); // idempotent on client_uuid
        synced += 1;
      } catch {
        const attempts = (s.attempts ?? 0) + 1;
        if (attempts < MAX_ATTEMPTS) survivors.push({ ...s, attempts });
        // else: give up on this one so it can't wedge the queue forever
      }
    }
    await writeQueue(survivors);
    return synced;
  } finally {
    draining = false;
  }
}
