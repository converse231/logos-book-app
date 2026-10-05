import { type Href } from 'expo-router';
import { ReturnTo } from '@/components/navigation/ReturnTo';

// RevenueCat paywall — Phase 4, not built. quire://upgrade is a registered route,
// so it must not render developer text; send it home until there is something to sell.
// A pop, not a <Redirect> (a replace): see components/navigation/ReturnTo.tsx.
export default function Route() {
  return <ReturnTo href={'/(tabs)/home' as Href} />;
}
