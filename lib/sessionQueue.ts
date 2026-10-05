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
import type { QuireApi } from '@/services/api';
import type { CompleteSessionResult, QueuedSession } from '@/services/types';
import { supabase } from '@/lib/supabase';

const KEY = 'logos.sessionQueue.v1';
const MAX_ATTEMPTS = 8; // drop after this many failed sends (matches §8 guidance)

// A queued item remembers whose it is. Without this, signing out offline and
// signing in as someone else drained the first reader's sessions against the
// second account, where the server rejected them as "not your book" until they
// hit MAX_ATTEMPTS and vanished.
type Stored = QueuedSession & { ownerId?: string };

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Will sending this again ever succeed? complete_session refuses impossible
 * input with SQLSTATE 22023 (SESSION_INVALID / SESSION_TOO_OLD / a book that is
 * no longer yours), and a 23xxx is a constraint the retry will hit again too.
 * Those are verdicts, not outages: queueing one showed the reader "Saved
 * offline" for a session that could never sync, then silently dropped it eight
 * launches later. A network failure has no SQLSTATE at all.
 */
export function isPermanentSessionError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^(22|23)/.test(code);
}

async function readQueue(): Promise<Stored[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored[]) : [];
  } catch (e) {
    console.warn('[sessionQueue] read failed', e);
    return [];
  }
}

async function writeQueue(items: Stored[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    // Non-fatal, but never silent: this is the only copy of an offline session.
    console.warn('[sessionQueue] write failed', e);
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
  q.push({ ...session, ownerId: (await currentUid()) ?? undefined });
  await writeQueue(q);
}

/** Online finish path: try to send; on failure, queue it. Returns the server
 *  result when it went through immediately, or null when it was queued.
 *  A permanent rejection is rethrown — queueing it would promise a sync that
 *  can never happen. */
export async function sendOrQueue(
  api: QuireApi,
  session: QueuedSession
): Promise<CompleteSessionResult | null> {
  try {
    return await api.completeSession(session);
  } catch (e) {
    if (isPermanentSessionError(e)) throw e;
    await enqueueSession(session);
    return null;
  }
}

let draining = false;

/** Try to flush the signed-in reader's queued sessions. Safe to call often
 *  (re-entrancy guarded). Successful, permanently-rejected and max-attempt
 *  items are removed; transient failures stay with an incremented attempt
 *  count; other accounts' items are left untouched. Returns how many synced. */
export async function drainQueue(api: QuireApi): Promise<number> {
  if (draining) return 0;
  draining = true;
  try {
    const snapshot = await readQueue();
    if (snapshot.length === 0) return 0;
    const uid = await currentUid();
    if (!uid) return 0;

    const done = new Set<string>();
    const retried = new Map<string, Stored>();
    let synced = 0;
    for (const s of snapshot) {
      // Items queued before ownerId existed belong to whoever drains first —
      // the pre-fix behaviour, and the server still rejects a foreign book.
      if (s.ownerId && s.ownerId !== uid) continue;
      try {
        await api.completeSession(s); // idempotent on client_uuid
        synced += 1;
        done.add(s.clientUuid);
      } catch (e) {
        const attempts = (s.attempts ?? 0) + 1;
        if (isPermanentSessionError(e) || attempts >= MAX_ATTEMPTS) {
          console.warn('[sessionQueue] dropping session', s.clientUuid, e);
          done.add(s.clientUuid);
        } else {
          retried.set(s.clientUuid, { ...s, attempts });
        }
      }
    }

    // Re-read before writing: a session finished offline WHILE this drain was
    // awaiting the network was appended to storage after our snapshot, and
    // writing the snapshot back used to erase it.
    const latest = await readQueue();
    await writeQueue(
      latest
        .filter((s) => !done.has(s.clientUuid))
        .map((s) => retried.get(s.clientUuid) ?? s)
    );
    return synced;
  } finally {
    draining = false;
  }
}
