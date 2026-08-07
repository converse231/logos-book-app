// The guided tour's content and its one bit of persistence.
//
// Three steps, offered once after onboarding, then replayable from More.
//
// Spotlight coach marks over the LIVE UI — the tour points at the real thing, so
// what you learn is where it actually is.
//
// An earlier attempt landed a status bar off on Android because it measured with
// measureInWindow (window space) while the overlay drew in the provider's space.
// TourProvider now measures with measureLayout against its own root, so both are
// in one coordinate space by construction and there is no inset to get wrong. See
// the comment on useTourTarget.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Elements the tour can spotlight. Each registers its own frame. */
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
    body: 'Tap this to time a session. It’s the only button you really need.',
  },
  {
    // The one mechanic people ask about. Naming restores here is what stops the
    // first broken streak feeling like a punishment.
    key: 'streak',
    title: 'Your streak',
    body: 'Read on any day to keep it going. Miss one and you can spend a restore — you get five.',
  },
  {
    // Ends on what they have to do next: a reader with no books can't use step one.
    key: 'library',
    title: 'Your shelf',
    body: 'Add books here — search by title, or scan a barcode with your camera.',
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
