import { type Href } from 'expo-router';
import { ReturnTo } from '@/components/navigation/ReturnTo';

// Mood Reader lives on the Discover tab now. Keep this route so the quire://ai
// deep link (blueprint §19) still lands somewhere sensible.
// A pop, not a <Redirect> (a replace): see components/navigation/ReturnTo.tsx.
export default function Route() {
  return <ReturnTo href={'/(tabs)/discover' as Href} />;
}
