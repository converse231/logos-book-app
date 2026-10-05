import { type Href } from 'expo-router';
import { ReturnTo } from '@/components/navigation/ReturnTo';

// The variable-reward insight renders inline on session-complete, not as its own
// route. Kept so quire://reading-insight (blueprint §19) lands somewhere sensible.
// A pop, not a <Redirect> (a replace): see components/navigation/ReturnTo.tsx.
export default function Route() {
  return <ReturnTo href={'/(tabs)/home' as Href} />;
}
