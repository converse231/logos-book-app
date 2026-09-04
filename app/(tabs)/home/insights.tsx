import { Redirect, type Href } from 'expo-router';

// Insight history has no screen yet — insights surface on session-complete and in
// Stats. Redirect rather than render the old "F4" placeholder, which shipped as a
// live route on quire://insights.
export default function InsightsRedirect() {
  return <Redirect href={'/(tabs)/stats' as Href} />;
}
