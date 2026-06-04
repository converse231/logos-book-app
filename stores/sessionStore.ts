import { create } from 'zustand';
import { BookFormat, CompleteSessionResult } from '@/services/types';

// Live session state for the tracker + the hand-off to the celebration screen.
// In Expo Go we keep this in memory; the MMKV offline queue (blueprint Section 8)
// lands with the dev-build / backend phase. The celebration reads `lastResult`
// instead of passing a large object through route params.
export interface ActiveSession {
  userBookId: string;
  bookId: string;
  bookTitle: string;
  coverUrl: string | null;
  format: BookFormat;
  startedAtMs: number; // device clock
  startPage: number;
  pageCount: number | null;
}

interface SessionState {
  active: ActiveSession | null;
  lastResult: CompleteSessionResult | null;

  startSession: (s: ActiveSession) => void;
  endSession: () => void;
  setResult: (r: CompleteSessionResult) => void;
  clearResult: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  active: null,
  lastResult: null,

  startSession: (s) => set({ active: s }),
  endSession: () => set({ active: null }),
  setResult: (r) => set({ lastResult: r }),
  clearResult: () => set({ lastResult: null }),
}));

/** Local YYYY-MM-DD for the device — the streak source of truth (frozen at capture). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lightweight uuid v4 (no native dep) for the session client_uuid idempotency key. */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
