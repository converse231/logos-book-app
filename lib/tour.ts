// The guided tour's content and its one bit of persistence.
//
// Three steps, all on Home, offered once after onboarding. Kept separate from the
// overlay component so the copy and the ordering are editable without opening any
// layout code — same reason lib/sessionCelebration.ts holds the pose ladder.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Elements the tour can spotlight. Each one registers its own frame. */
export type TourTargetKey = 'record' | 'streak' | 'library';

export interface TourStep {
  key: TourTargetKey;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    // First because everything else in the app exists to serve it.
    key: 'record',
    title: 'Start reading here',
    body: "Tap this to time a session. It's the only button you really need.",
  },
  {
    // The one mechanic people ask about. Naming restores here is what stops the
    // first broken streak feeling like a punishment.
    key: 'streak',
    title: 'Your streak',
    body: 'Read on any day to keep it going. Miss one and you can spend a restore.',
  },
  {
    // Ends on what they have to do next: a reader with no books can't use step one.
    key: 'library',
    title: 'Your shelf',
    body: 'Add books here — search, or scan a barcode with the camera.',
  },
];

const KEY = 'quire.tourSeen.v1';

/** True only the first time, whether they take it or decline it. */
export async function shouldOfferTour(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === null;
  } catch {
    // A storage failure must not pop the sheet on every single focus.
    return false;
  }
}

/** Called on accept AND on decline — the offer is one-shot either way, because
 *  "Take the tour" under More is what makes declining reversible. */
export async function markTourSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* not worth surfacing */
  }
}
