import { Redirect, type Href } from 'expo-router';

// The centre tab slot is a non-interactive spacer (see (tabs)/_layout.tsx) that
// the raised "record a session" FAB floats over — so this screen is normally
// never shown. It exists only because Expo Router needs a file for the route;
// if it is ever reached via a deep link, fall back to Home.
export default function RecordPlaceholder() {
  return <Redirect href={'/(tabs)/home' as Href} />;
}
