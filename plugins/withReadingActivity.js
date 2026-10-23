// Config plugin for the reading-activity native module.
//
//   • iOS     → enables Live Activities (Info.plist NSSupportsLiveActivities).
//   • Android → adds the foreground-service permissions and declares the
//               ReadingTimerService with a foregroundServiceType.
//
// The iOS WIDGET EXTENSION target itself comes from @bacons/apple-targets
// (targets/reading-widget/). This plugin only wires the parts that are safe and
// declarative, plus a guard that the two copies of the activity's attributes
// still match. It is a no-op for the JS bundle / Expo Go; its effects apply only
// during `expo prebuild` / an EAS build.

const fs = require('fs');
const path = require('path');
const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

// ActivityKit pairs the app's and the widget's ReadingActivityAttributes by type
// name and Codable shape. Two copies drifting apart compiles cleanly and fails
// only on a phone, as a Live Activity that never appears — so fail the prebuild.
const ATTRIBUTES = [
  'modules/reading-activity/ios/ReadingActivityAttributes.swift',
  'targets/reading-widget/ReadingActivityAttributes.swift',
];
function assertAttributesInSync(projectRoot) {
  const [a, b] = ATTRIBUTES.map((f) => fs.readFileSync(path.join(projectRoot, f), 'utf8'));
  if (a !== b) {
    throw new Error(
      `[withReadingActivity] ${ATTRIBUTES[0]} and ${ATTRIBUTES[1]} differ. ` +
        'They must be byte-identical or the Live Activity will not render.'
    );
  }
}

const SERVICE_NAME = 'expo.modules.readingactivity.ReadingTimerService';
const ANDROID_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];

function withIos(config) {
  return withInfoPlist(config, (cfg) => {
    assertAttributesInSync(cfg.modRequest.projectRoot);
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
