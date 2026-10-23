// Widget Extension for the live reading timer (Lock Screen + Dynamic Island).
// Generated into the Xcode project by @bacons/apple-targets at `expo prebuild`;
// never add it by hand in Xcode — a --clean prebuild would throw that away.
// The UI self-counts from `startedAt`, so it needs no app group or push.

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'ReadingWidget',
  displayName: 'Quire reading timer',
  // Matches the app's own floor (SDK 56+). Live Activities themselves need
  // 16.2, which this already clears.
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
};
