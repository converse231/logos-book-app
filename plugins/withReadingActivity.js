// Config plugin for the reading-activity native module.
//
//   • iOS     → enables Live Activities (Info.plist NSSupportsLiveActivities).
//   • Android → adds the foreground-service permissions and declares the
//               ReadingTimerService with a foregroundServiceType.
//
// The iOS WIDGET EXTENSION target itself is not added here (that's an Xcode
// target — see modules/reading-activity/README.md). This plugin only wires the
// parts that are safe and declarative. It is a no-op for the JS bundle / Expo Go;
// its effects apply only during `expo prebuild` / an EAS build.

const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

const SERVICE_NAME = 'expo.modules.readingactivity.ReadingTimerService';
const ANDROID_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];

function withIos(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true;
    return cfg;
  });
}

function ensurePermission(manifest, name) {
  const list = (manifest['uses-permission'] = manifest['uses-permission'] || []);
  if (!list.some((p) => p.$ && p.$['android:name'] === name)) {
    list.push({ $: { 'android:name': name } });
  }
}

function withAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    ANDROID_PERMISSIONS.forEach((p) => ensurePermission(manifest, p));

    const application = manifest.application && manifest.application[0];
    if (application) {
      const services = (application.service = application.service || []);
      const exists = services.some(
        (s) => s.$ && s.$['android:name'] === SERVICE_NAME
      );
      if (!exists) {
        services.push({
          $: {
            'android:name': SERVICE_NAME,
            'android:exported': 'false',
            'android:foregroundServiceType': 'specialUse',
          },
          property: [
            {
              $: {
                'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
                // Android 14 requires a human-readable reason for a specialUse FGS.
                'android:value': 'Shows the live reading-session timer on the lock screen.',
              },
            },
          ],
        });
      }
    }
    return cfg;
  });
}

module.exports = function withReadingActivity(config) {
  return withAndroid(withIos(config));
};
