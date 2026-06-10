import { Redirect, type Href } from 'expo-router';

// Mood Reader lives on the Discover tab now. Keep this route as a redirect so the
// logos://ai deep link (blueprint §19) still lands somewhere sensible.
export default function AiRedirect() {
  return <Redirect href={'/(tabs)/discover' as Href} />;
}
