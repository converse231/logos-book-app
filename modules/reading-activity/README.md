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
- ✅ **Android** — module + `ReadingTimerService` (foreground service). Compile-ready.
- ✅ **iOS module** (`ReadingActivityModule.swift`) — ActivityKit start/update/end. Compile-ready.
- ⚠️ **iOS widget UI** — `ios/widget/*.swift` needs a **Widget Extension target** (below).
- ✅ **Config plugin** (`plugins/withReadingActivity.js`) — Info.plist + Android manifest.

Nothing here runs in Expo Go. It activates on an **EAS dev/preview build** (`eas build`)
or after `npx expo prebuild`.

## The one manual step: the iOS Widget Extension target

A Live Activity's UI must live in a **Widget Extension** target (a separate binary),
which is an Xcode-target change config plugins don't do cleanly by hand. Two options:

**Option A — `@bacons/apple-targets` (recommended, declarative):**
1. `npx expo install @bacons/apple-targets`
2. Add `"@bacons/apple-targets"` to `app.json` → `plugins`.
3. Create `targets/reading-widget/expo-target.config.js`:
   ```js
   module.exports = { type: 'widget', name: 'ReadingWidget', deploymentTarget: '16.2' };
   ```
4. Move `ios/widget/ReadingActivityWidget.swift` + `ReadingWidgetBundle.swift` and a
   **copy** of `ReadingActivityAttributes.swift` into `targets/reading-widget/`.
5. `npx expo prebuild -p ios` → the target is generated.

**Option B — manual Xcode target:**
1. Open the prebuilt `ios/*.xcworkspace`.
2. File → New → Target → **Widget Extension** (check *Include Live Activity*), name it `ReadingWidget`.
3. Replace its generated files with `ios/widget/ReadingActivityWidget.swift` +
   `ReadingWidgetBundle.swift`.
4. Add `ReadingActivityAttributes.swift` to **both** target memberships (app + widget).

## Verify on a build

- **iOS:** real device, iOS 16.2+, Settings → your app → *Live Activities* on. Start a
  session → the timer appears on the Lock Screen and Dynamic Island and ticks on its own.
- **Android:** start a session → an ongoing notification shows a live MM:SS chronometer;
  pause freezes it; finishing/cancelling dismisses it.

The Android `foregroundServiceType` is `specialUse` with a declared reason (required by
Android 14). If Google Play ever questions it, `shortService` is the fallback for the
typical short reading session.
