# reading-activity

Local Expo module for the **live reading-session timer** — a lock-screen / notification
timer that keeps counting while the user is outside the app (like Strava).

- **iOS** → an ActivityKit **Live Activity** (Lock Screen + Dynamic Island)
- **Android** → a **foreground service** with an ongoing chronometer notification

Both widgets **self-count** elapsed time from `startedAtMs`, so JS only ever calls
`start` / `update` / `end` — never a per-second tick. The tracker already does this
through `lib/liveActivity.ts`; this module is what those calls resolve to on a build.

## Status

- ✅ **JS surface** (`index.ts`) — safe no-op in Expo Go (`requireOptionalNativeModule`).
- ✅ **Android** — module + `ReadingTimerService` (foreground service).
- ✅ **iOS module** (`ios/ReadingActivityModule.swift`) — ActivityKit start/update/end.
- ✅ **iOS widget** — `targets/reading-widget/` (Lock Screen + Dynamic Island UI), turned
  into a `ReadingWidget` Widget Extension target by **`@bacons/apple-targets`** at prebuild.
- ✅ **Config plugin** (`plugins/withReadingActivity.js`) — Info.plist `NSSupportsLiveActivities`,
  Android manifest, and a prebuild guard that the two `ReadingActivityAttributes.swift`
  copies are byte-identical.

Nothing here runs in Expo Go. It activates in a dev/standalone build
(`npx expo run:ios --device`, or `eas build`).

## How the iOS widget is wired

`ios/` is generated — **never add or edit the target in Xcode**; a `--clean` prebuild
throws that away. The widget lives in `targets/reading-widget/`:

- `expo-target.config.js` — `type: 'widget'`, deployment target 16.4.
- `ReadingWidgetBundle.swift` (`@main`) + `ReadingActivityWidget.swift` — the UI.
- `ReadingActivityAttributes.swift` — a **copy** of `ios/ReadingActivityAttributes.swift`.
  ActivityKit pairs the app's and widget's copies by type name + Codable shape, so edit
  both together; prebuild fails if they differ.

After changing anything in `targets/` or `app.json`: `npx expo prebuild -p ios --clean`.

## Free Apple ID (no paid developer account)

A Personal Team can sign the app and this widget, but not Sign in with Apple or push.
`QUIRE_FREE_SIGNING=1` (see `app.config.js`) strips those two entitlements from local
builds only:

```bash
QUIRE_FREE_SIGNING=1 npx expo prebuild -p ios --clean
QUIRE_FREE_SIGNING=1 npx expo run:ios --device
```

Free-signed builds expire after 7 days — re-run `run:ios --device` to refresh.

## Verify on a build

- **iOS:** real device, iOS 16.2+, Settings → your app → *Live Activities* on. Start a
  session → the timer appears on the Lock Screen and Dynamic Island and ticks on its own.
- **Android:** start a session → an ongoing notification shows a live MM:SS chronometer;
  pause freezes it; finishing/cancelling dismisses it.

The Android `foregroundServiceType` is `specialUse` with a declared reason (required by
Android 14). If Google Play ever questions it, `shortService` is the fallback for the
typical short reading session.
