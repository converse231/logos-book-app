import { create } from 'zustand';
import { ThemePref } from '@/services/types';

// App-wide UI state that must survive across the navigation tree. Theme lives
// here (not in component state) so the onboarding theme toggle previews live and
// settings can change it later. Backed by MMKV persistence in a later phase.
interface AppState {
  theme: ThemePref;
  setTheme: (theme: ThemePref) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
