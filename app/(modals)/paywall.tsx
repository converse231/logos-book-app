import { Redirect, type Href } from 'expo-router';

// RevenueCat paywall — Phase 4, not built. quire://upgrade is a real registered
// route, so it must not render developer text; send it home until there is
// something to sell.
export default function PaywallRedirect() {
  return <Redirect href={'/(tabs)/home' as Href} />;
}
