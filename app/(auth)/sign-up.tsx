import { Redirect, type Href } from 'expo-router';

// Sign-up lives at the end of onboarding (the "signup-last" flow in (onboarding)/account),
// so there is no standalone screen. This route existed as an "F1 — to be built"
// placeholder, which expo-router still registered — quire://sign-up rendered dev
// text in a shipped build. Send it to the real door instead.
export default function SignUpRedirect() {
  return <Redirect href={'/(auth)/sign-in' as Href} />;
}
