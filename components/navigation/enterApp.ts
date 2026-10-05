import { useNavigationContainerRef } from 'expo-router';

/*
 * Enter the tab app as the ONLY thing on the stack.
 *
 * A returning reader reaches sign-in by pushing it from onboarding
 * (welcome / age-gate / account → "Sign in"). A `replace` into the tabs from there
 * swaps only the sign-in screen, leaving onboarding mounted underneath the app for
 * the whole session — and a back-swipe from Home returned to the welcome screen.
 * A root reset replaces the entire stack in one action: whatever led here is gone.
 *
 * Use it wherever authentication completes. It is correct from any entry point
 * (pushed over onboarding, or reached by signing out from the tabs).
 */
export function useEnterApp() {
  const nav = useNavigationContainerRef();
  return () => nav.reset({ index: 0, routes: [{ name: '(tabs)' }] });
}
