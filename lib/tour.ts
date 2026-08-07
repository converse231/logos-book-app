// The guided tour's content and its one bit of persistence.
//
// Three cards, offered once after onboarding, then replayable from More.
//
// These used to be spotlight coach marks that measured live UI. That approach was
// abandoned (2026-08-07) after it landed wrong on Android: measureInWindow and
// absolutely-positioned overlays disagree about whether the status bar counts, and
// SDK 54 draws edge-to-edge by default, which changes the answer again. Three of
// our targets also live in two different navigation trees. A fixed layout can't be
// off by an inset, so these cards render identically on every device.
//
// The trade is real and worth naming: nothing points at the live UI any more, so
// the copy has to say WHERE things are. Hence "the ▶ button at the bottom" rather
// than "tap this".

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QExpression } from '@/components/shared/Q';

export interface TourStep {
  key: string;
  expression: QExpression;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    // First because everything else in the app exists to serve it.
    key: 'record',
    expression: 'pointing',
    title: 'Start a session',
    body: 'The ▶ button at the bottom times your reading. It’s the only button you really need.',
  },
  {
    // The one mechanic people ask about. Naming restores here is what stops the
    // first broken streak feeling like a punishment.
    key: 'streak',
    expression: 'confident',
    title: 'Keep your streak',
    body: 'Read on any day and your streak grows. Miss one and you can spend a restore — you get five.',
  },
  {
    // Ends on what they have to do next: a reader with no books can't use step one.
    key: 'library',
    expression: 'looking-up',
    title: 'Build your shelf',
    body: 'Add books from the Library tab — search by title, or scan a barcode with your camera.',
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
