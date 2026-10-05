import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemePref } from '@/services/types';

// App-wide UI state that must survive across the navigation tree. Theme lives
// here (not in component state) so the onboarding theme toggle previews live and
// settings can change it later.
//
// Persisted locally. It used to be memory-only, so choosing Dark (or System) in
// Settings held for the session and silently reverted to Light on the next cold
// start. AsyncStorage, not MMKV, for the same reasons as the session queue: it is
// already installed and works in Expo Go and standalone alike.
//
// ponytail: local only, not synced to users.theme. The column exists and is
// grantable, but cross-device sync needs a rule for which side wins on conflict —
// add it when there's a second device to disagree with.
interface AppState {
  theme: ThemePref;
  setTheme: (theme: ThemePref) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Paper & Ink is light-first. Dark is a fallback.
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'quire.appPrefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ theme: s.theme }),
    }
  )
);

/** True once the persisted prefs are loaded — gate the first frame on it so a
 *  dark-mode reader never sees a flash of light paper at launch. */
export function hasHydratedPrefs(): boolean {
  return useAppStore.persist.hasHydrated();
}
export function onPrefsHydrated(cb: () => void): () => void {
  return useAppStore.persist.onFinishHydration(cb);
}
