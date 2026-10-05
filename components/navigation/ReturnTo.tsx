import { useFocusEffect, useRouter, type Href } from 'expo-router';

/*
 * `<Redirect>`, but it POPS back to an existing screen instead of replacing.
 *
 * `<Redirect>` is hard-wired to `router.replace`. Replacing into `/(tabs)` from
 * anywhere above the tab app does not go back to it — expo-router targets the
 * root stack (where the two paths diverge) and splices in a SECOND copy of the
 * whole tab navigator. If a modal is anywhere below that copy, it inherits the
 * native stack's default `presentation: 'modal'` (see getModalRouteKeys), which
 * on iOS is a pageSheet: the entire app, tab bar and all, inside a sheet.
 *
 * `dismissTo` walks back to the existing route and pops everything above it,
 * falling back to a replace only when the route isn't in the stack at all
 * (a cold-start deep link) — so it is correct in both cases.
 *
 * ponytail: no link-preview guard (`<Redirect>` has one). The only hook for it is
 * a private `expo-router/build/...` import, and these stub routes are never the
 * target of an iOS long-press link preview. Add it if one ever becomes one.
 */
export function ReturnTo({ href }: { href: Href }) {
  const router = useRouter();
  useFocusEffect(() => {
    router.dismissTo(href);
  });
  return null;
}
