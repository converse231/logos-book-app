import { create } from 'zustand';
import { ThemePref } from '@/services/types';

// Holds onboarding selections across the multi-screen flow.
// Each screen also persists to the (mock) API, but keeping the choices here
// lets later screens (e.g. goal projection, profile summary) read them without
// a round-trip.
interface OnboardingState {
  birthYear: number | null;
  isMinor: boolean;
  genres: string[];
  goalBooks: number;
  username: string;
  theme: ThemePref;

  setBirthYear: (year: number, isMinor: boolean) => void;
  toggleGenre: (genre: string) => void;
  setGoalBooks: (n: number) => void;
  setUsername: (name: string) => void;
  setTheme: (theme: ThemePref) => void;
  reset: () => void;
}

const INITIAL = {
  birthYear: null,
  isMinor: false,
  genres: [] as string[],
  goalBooks: 24,
  username: '',
  theme: 'dark' as ThemePref,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...INITIAL,

  setBirthYear: (year, isMinor) => set({ birthYear: year, isMinor }),
  toggleGenre: (genre) =>
    set((s) => ({
      genres: s.genres.includes(genre)
        ? s.genres.filter((g) => g !== genre)
        : [...s.genres, genre],
    })),
  setGoalBooks: (n) => set({ goalBooks: n }),
  setUsername: (name) => set({ username: name }),
  setTheme: (theme) => set({ theme }),
  reset: () => set(INITIAL),
}));
