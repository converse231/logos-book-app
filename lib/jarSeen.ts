// What the reader has already seen in their jar.
//
// The server is the authority on the balance; this only remembers the number
// the jar was last *opened* at, so Home can tell "you have 40 fireflies" from
// "8 of those arrived since you last looked". Local on purpose — it's a UI
// nicety, not account state, and it should reset on a new device rather than
// follow someone around.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'quire.jarSeen.v1';

export async function getSeenFireflies(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw == null ? 0 : Number(raw) || 0;
  } catch {
    // A storage failure should read as "nothing new" rather than lighting the
    // badge up on every launch.
    return Number.MAX_SAFE_INTEGER;
  }
}

export async function markFirefliesSeen(balance: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(balance));
  } catch {
    /* the badge reappearing is a small enough cost to swallow */
  }
}
