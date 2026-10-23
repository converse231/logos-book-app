// Dynamic layer over app.json — everything static stays in app.json.
//
// QUIRE_FREE_SIGNING=1 — for building onto a phone with a FREE Apple ID
// (Xcode "Personal Team"). A free team cannot sign the Sign in with Apple or
// Push Notifications capabilities, so a build that asks for them fails before it
// ever reaches the phone. This drops just those two from LOCAL builds:
//
//   QUIRE_FREE_SIGNING=1 QUIRE_APPLE_TEAM_ID=XXXXXXXXXX npx expo run:ios --device
//
// In such a build the Apple button hides itself (isAvailableAsync still says yes,
// but sign-in would fail — test Apple in Expo Go instead) and push registration
// no-ops. EAS and store builds never set the flag, so they are unaffected.

const { withEntitlementsPlist } = require('expo/config-plugins');

// Removing the plugins from the list is not enough: prebuild auto-applies both
// for any installed package. So strip the entitlements they write instead.
const PAID_ONLY_ENTITLEMENTS = ['com.apple.developer.applesignin', 'aps-environment'];

const withoutPaidEntitlements = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    PAID_ONLY_ENTITLEMENTS.forEach((key) => delete cfg.modResults[key]);
    return cfg;
  });

module.exports = ({ config }) => {
  // QUIRE_APPLE_TEAM_ID — your team id (Xcode → Settings → Accounts), so local
  // builds sign the app AND the ReadingWidget extension without a trip into
  // Xcode after every --clean prebuild. An env var, not app.json, so a personal
  // team never ends up in a committed config that EAS would then build with.
  const teamId = process.env.QUIRE_APPLE_TEAM_ID;
  if (teamId) config = { ...config, ios: { ...config.ios, appleTeamId: teamId } };

  if (process.env.QUIRE_FREE_SIGNING !== '1') return config;
  return withoutPaidEntitlements({
    ...config,
    extra: { ...config.extra, freeSigning: true },
  });
};
