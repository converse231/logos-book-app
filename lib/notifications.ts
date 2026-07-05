// ─────────────────────────────────────────────────────────────────────────────
// Push-notification client helper (B5 / blueprint §16).
//
// Requests permission, obtains the Expo push token, and hands it to the API so
// the server can target this device. Everything is wrapped defensively: in Expo
// Go (where remote push is unsupported on SDK 53+) or on a simulator/web, this
// no-ops instead of throwing — so it's safe to call now and "just works" once a
// real dev/preview build runs it.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { LogosApi } from '@/services/api';

// Foreground behavior: show the banner + play sound even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Running inside Expo Go? Remote push isn't available there, so skip registration.
const isExpoGo = Constants.appOwnership === 'expo';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Ask for permission and register this device's Expo push token with the server.
 *  Idempotent and safe to call repeatedly. Returns the token, or null if it
 *  couldn't register (no permission, Expo Go, simulator, etc.). */
export async function registerForPushNotifications(api: LogosApi): Promise<string | null> {
  try {
    if (isExpoGo || !Device.isDevice) return null; // no push in Expo Go / on simulators

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reading reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = getProjectId();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenRes.data;
    if (token) await api.registerPushToken(token);
    return token ?? null;
  } catch {
    return null; // never let push registration break a flow
  }
}
