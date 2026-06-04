import { Redirect } from 'expo-router';

// Boot redirect: during frontend-first phase always land on onboarding.
// Replace with an auth-check once the Supabase backend is wired up.
export default function Index() {
  return <Redirect href="/(onboarding)/age-gate" />;
}
