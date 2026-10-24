// Public legal pages, served by GitHub Pages from docs/ (so editing
// docs/privacy.html and pushing to main is how the policy changes).
//
// App Store Guideline 5.1.1(i) wants the privacy policy reachable from INSIDE the
// app, not only from the store listing — so this is opened from Settings and
// from the account step, before a reader hands over anything.

import * as WebBrowser from 'expo-web-browser';

export const PRIVACY_POLICY_URL = 'https://converse231.github.io/logos-book-app/privacy.html';

/** Opens the privacy policy in the in-app browser (SFSafariViewController /
 *  Custom Tabs), so the reader returns to exactly where they were. */
export async function openPrivacyPolicy(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  } catch (e) {
    console.warn('[legal] could not open the privacy policy', e);
  }
}
