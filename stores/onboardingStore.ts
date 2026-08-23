import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Holds onboarding selections across the multi-screen flow. Nothing is written
// to the server until the final step, which flushes the whole lot through the
// single `complete_onboarding` RPC — so this store IS the funnel's state, not a
// convenience cache.
//
// PERSISTED, and that is load-bearing. The Google sign-in step sends the app to
// a Chrome Custom Tab; Android routinely kills the backgrounded RN process while
// it's there. The Supabase session survives (AsyncStorage) but an in-memory
// store did not — so the app came back authenticated with birthYear/genres/goal/
// username all blank, and finished onboarding onto an empty account. Both halves
// of the funnel state have to have the same lifetime.
export interface OnboardingState {
  birthYear: number | null;
  isMinor: boolean;
  genres: string[];
  goalBooks: number;
  /** goalBooks has a sensible default, so "did they confirm it" needs its own
   *  flag — otherwise resume can't tell an accepted goal from an unseen one. */
  goalSet: boolean;
  username: string;
  /** Picked photo, NOT persisted — see partialize. */
  avatar: { uri: string; base64: string } | null;

  setBirthYear: (year: number, isMinor: boolean) => void;
  toggleGenre: (genre: string) => void;
  setGoalBooks: (n: number) => void;
  setUsername: (name: string) => void;
  setAvatar: (avatar: { uri: string; base64: string } | null) => void;
  reset: () => void;
}

const INITIAL = {
  birthYear: null,
  isMinor: false,
  genres: [] as string[],
  goalBooks: 24,
  goalSet: false,
  username: '',
  avatar: null as { uri: string; base64: string } | null,
};

export const MIN_GENRES = 2;

/** The funnel, in order. `app/index.tsx` and the screens both route off this. */
export const ONBOARDING_STEPS = [
  '/(onboarding)/welcome',
  '/(onboarding)/age-gate',
  '/(onboarding)/genres',
  '/(onboarding)/goal',
  '/(onboarding)/profile',
  '/(onboarding)/account',
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

/**
 * First step whose answer is still missing — so a reader who is interrupted
 * (or whose app is killed behind the Google browser tab) resumes where they
 * stopped instead of being re-asked for a birth year they already gave.
 *
 * Welcome is index 0 and asks nothing, so it is only ever the answer when the
 * funnel is completely untouched.
 */
export function firstIncompleteStep(
  s: Pick<OnboardingState, 'birthYear' | 'genres' | 'goalSet' | 'username'>
): number {
  if (s.birthYear == null) return s.genres.length === 0 && !s.username ? 0 : 1;
  if (s.genres.length < MIN_GENRES) return 2;
  if (!s.goalSet) return 3;
  if (!s.username.trim()) return 4;
  return 5; // everything answered — only the account remains
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setBirthYear: (year, isMinor) => set({ birthYear: year, isMinor }),
      toggleGenre: (genre) =>
        set((s) => ({
          genres: s.genres.includes(genre)
            ? s.genres.filter((g) => g !== genre)
            : [...s.genres, genre],
        })),
      setGoalBooks: (n) => set({ goalBooks: n, goalSet: true }),
      setUsername: (name) => set({ username: name }),
      setAvatar: (avatar) => set({ avatar }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'quire.onboarding.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Answers only — never the actions, and never the avatar: a base64 JPEG is
      // hundreds of KB and AsyncStorage is a small key-value store, not a blob
      // store. Losing the photo to a process death is survivable; losing the
      // answers is what created empty accounts.
      partialize: (s) => ({
        birthYear: s.birthYear,
        isMinor: s.isMinor,
        genres: s.genres,
        goalBooks: s.goalBooks,
        goalSet: s.goalSet,
        username: s.username,
      }),
    }
  )
);
