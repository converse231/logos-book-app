import { Redirect, type Href } from 'expo-router';

// The variable-reward insight is rendered inline on the session-complete screen,
// not as its own route. Kept as a redirect so quire://reading-insight (blueprint
// §19) can't surface the old "F2 — to be built" placeholder.
export default function ReadingInsightRedirect() {
  return <Redirect href={'/(tabs)/home' as Href} />;
}
