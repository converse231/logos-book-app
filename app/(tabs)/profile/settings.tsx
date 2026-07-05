import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useAppStore } from '@/stores/appStore';
import { NotificationSettings, ThemePref, UserProfile } from '@/services/types';
import { registerForPushNotifications } from '@/lib/notifications';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const THEME_OPTIONS: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

// Settings (blueprint Section 3). Theme, display name/username, and notification
// placeholder. Writing profile calls api.updateProfile; theme is local via appStore.
export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const themePref = useAppStore((s) => s.theme);
  const setThemePref = useAppStore((s) => s.setTheme);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [notif, setNotif] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getProfile().then((p) => {
        if (!alive) return;
        setProfile(p);
        setDisplayName(p.displayName ?? '');
        setUsername(p.username ?? '');
        setBio(p.bio ?? '');
      });
      api.getNotificationSettings().then((n) => alive && setNotif(n)).catch(() => {});
      return () => { alive = false; };
    }, [api])
  );

  // Optimistic preference write (revert on failure). Turning the master switch ON
  // also prompts for OS permission + registers this device's push token.
  const patchNotif = async (patch: Partial<NotificationSettings>) => {
    if (!notif) return;
    const prev = notif;
    setNotif({ ...notif, ...patch });
    Haptics.selectionAsync();
    try {
      if (patch.enabled === true) registerForPushNotifications(api); // fire-and-forget
      await api.updateNotificationSettings(patch);
    } catch {
      setNotif(prev);
    }
  };

  const saveProfile = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName: displayName.trim(), username: username.trim(), bio: bio.trim() || null });
      setProfile(updated);
    } finally {
      setSaving(false);
    }
  };

  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const changeAvatar = async () => {
    if (uploadingAvatar) return;
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access in Settings to choose a picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    setUploadingAvatar(true);
    try {
      const url = await api.uploadAvatar(res.assets[0].base64);
      const updated = await api.updateProfile({ avatarUrl: url });
      setProfile(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await api.signOut();
          router.replace('/(auth)/sign-in' as Href);
        },
      },
    ]);
  };

  const exportData = async () => {
    if (busy) return;
    Haptics.selectionAsync();
    setBusy('export');
    try {
      const json = await api.exportData();
      await Share.share({ message: json });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = () => {
    if (busy) return;
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and everything in it — books, sessions, streak, XP, and reviews. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await api.deleteAccount();
              router.replace('/(auth)/sign-in' as Href);
            } catch (e: any) {
              setBusy(null);
              Alert.alert('Could not delete account', e?.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const dirty = profile && (
    displayName.trim() !== (profile.displayName ?? '') ||
    username.trim() !== (profile.username ?? '') ||
    bio.trim() !== (profile.bio ?? '')
  );

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Text style={[styles.title, { color: t.text }]}>Settings</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Reveal i={0} reduce={reduce}>
          <SectionTitle label="Appearance" t={t} />
          <Card padded={false}>
            <View style={styles.themePicker}>
              {THEME_OPTIONS.map((opt) => {
                const active = themePref === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => { Haptics.selectionAsync(); setThemePref(opt.key); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.themeOption,
                      { borderColor: active ? t.accent : 'transparent', backgroundColor: active ? t.accentMuted : 'transparent' },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={22} color={active ? t.accent : t.textSec} />
                    <Text style={[styles.themeLabel, { color: active ? t.accent : t.textSec }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Reveal>

        <Reveal i={1} reduce={reduce}>
          <SectionTitle label="Notifications" t={t} />
          <Card padded={false}>
            <NotifRow
              icon="notifications-outline"
              title="Enable notifications"
              sub="Streak saves, reminders, and your reading wins"
              value={notif?.enabled ?? false}
              onToggle={(v) => patchNotif({ enabled: v })}
              t={t}
            />
            {notif?.enabled ? (
              <>
                <NotifRow
                  icon="alarm-outline"
                  title="Daily reminder"
                  sub={notif.dailyReminder ? `Every day at ${formatHour(notif.dailyReminderHour)}` : 'A nudge to keep your streak'}
                  value={notif.dailyReminder}
                  onToggle={(v) => patchNotif({ dailyReminder: v })}
                  t={t}
                />
                {notif.dailyReminder ? (
                  <View style={[styles.hourRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.hourLabel, { color: t.textSec }]}>Reminder time</Text>
                    <View style={styles.hourStepper}>
                      <Pressable
                        onPress={() => patchNotif({ dailyReminderHour: (notif.dailyReminderHour + 23) % 24 })}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Earlier"
                        style={[styles.hourBtn, { borderColor: t.border }]}
                      >
                        <Ionicons name="remove" size={18} color={t.text} />
                      </Pressable>
                      <Text style={[styles.hourValue, { color: t.text }]}>{formatHour(notif.dailyReminderHour)}</Text>
                      <Pressable
                        onPress={() => patchNotif({ dailyReminderHour: (notif.dailyReminderHour + 1) % 24 })}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Later"
                        style={[styles.hourBtn, { borderColor: t.border }]}
                      >
                        <Ionicons name="add" size={18} color={t.text} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <NotifRow
                  icon="flame-outline"
                  title="Streak at-risk alerts"
                  sub="When your streak is about to end tonight"
                  value={notif.atRiskAlerts}
                  onToggle={(v) => patchNotif({ atRiskAlerts: v })}
                  t={t}
                />
                <NotifRow
                  icon="flash-outline"
                  title="Comeback challenges"
                  sub="When you can restore a broken streak"
                  value={notif.comebackAlerts}
                  onToggle={(v) => patchNotif({ comebackAlerts: v })}
                  t={t}
                />
                <NotifRow
                  icon="bulb-outline"
                  title="Reading insights"
                  sub="Personal stats unlocked from your sessions"
                  value={notif.insightAlerts}
                  onToggle={(v) => patchNotif({ insightAlerts: v })}
                  t={t}
                />
                <NotifRow
                  icon="calendar-outline"
                  title="Weekly digest"
                  sub="Your week in pages and sessions"
                  value={notif.weeklyDigest}
                  onToggle={(v) => patchNotif({ weeklyDigest: v })}
                  t={t}
                  last
                />
              </>
            ) : null}
          </Card>
        </Reveal>

        <Reveal i={2} reduce={reduce}>
          <SectionTitle label="Profile" t={t} />
          <Card padded style={styles.profileInputs}>
            {/* Profile photo */}
            <Pressable
              onPress={changeAvatar}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={styles.avatarRow}
            >
              <View style={styles.avatarBox}>
                <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
                  {profile?.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={34} color={t.accent} />
                  )}
                </View>
                <View style={[styles.avatarBadge, { backgroundColor: t.accent, borderColor: t.border }]}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={t.onAccent} />
                  ) : (
                    <Ionicons name="camera" size={14} color={t.onAccent} />
                  )}
                </View>
              </View>
              <Text style={[styles.avatarHint, { color: t.accent }]}>
                {uploadingAvatar ? 'Uploading…' : 'Change photo'}
              </Text>
            </Pressable>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: t.textSec }]}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={t.textTer}
                style={[styles.input, { color: t.text, borderBottomColor: t.border }]}
                maxLength={40}
                returnKeyType="next"
                accessibilityLabel="Display name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: t.textSec }]}>Username</Text>
              <View style={styles.usernameRow}>
                <Text style={[styles.atSign, { color: t.textSec }]}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  placeholderTextColor={t.textTer}
                  style={[styles.input, styles.usernameInput, { color: t.text, borderBottomColor: t.border }]}
                  maxLength={30}
                  autoCapitalize="none"
                  returnKeyType="done"
                  accessibilityLabel="Username"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: t.textSec }]}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="A line about your reading life"
                placeholderTextColor={t.textTer}
                style={[styles.bioInput, { color: t.text, borderColor: t.border, backgroundColor: t.bgTer }]}
                maxLength={160}
                multiline
                accessibilityLabel="Bio"
              />
              <Text style={[styles.bioCount, { color: t.textTer }]}>{bio.length}/160</Text>
            </View>
            {dirty ? <PrimaryButton label="Save changes" onPress={saveProfile} loading={saving} /> : null}
          </Card>
        </Reveal>

        <Reveal i={3} reduce={reduce}>
          <SectionTitle label="Goal" t={t} />
          <Card padded={false}>
            <Pressable
              onPress={() => router.push('/(modals)/goal-edit' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Edit reading goal"
              style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="flag-outline" size={20} color={t.accent} />
              <Text style={[styles.menuLabel, { color: t.text }]}>Edit reading goal</Text>
              <Ionicons name="chevron-forward" size={18} color={t.textTer} />
            </Pressable>
          </Card>
        </Reveal>

        <Reveal i={4} reduce={reduce}>
          <SectionTitle label="Account" t={t} />
          <Card padded={false}>
            {profile?.email ? (
              <View style={[styles.menuRow, { borderBottomColor: t.border }]}>
                <Ionicons name="mail-outline" size={20} color={t.textSec} />
                <Text style={[styles.menuLabel, { color: t.text }]} numberOfLines={1}>{profile.email}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={exportData}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Export my data"
              style={({ pressed }) => [styles.menuRow, { borderBottomColor: t.border }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="download-outline" size={20} color={t.textSec} />
              <Text style={[styles.menuLabel, { color: t.text }]}>
                {busy === 'export' ? 'Preparing export…' : 'Export my data'}
              </Text>
              {busy === 'export' ? <ActivityIndicator size="small" color={t.textSec} /> : null}
            </Pressable>
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [styles.menuRow, { borderBottomColor: t.border }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="log-out-outline" size={20} color={t.text} />
              <Text style={[styles.menuLabel, { color: t.text }]}>Sign out</Text>
            </Pressable>
            <Pressable
              onPress={deleteAccount}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="trash-outline" size={20} color={t.danger} />
              <Text style={[styles.menuLabel, { color: t.danger }]}>
                {busy === 'delete' ? 'Deleting…' : 'Delete account'}
              </Text>
              {busy === 'delete' ? <ActivityIndicator size="small" color={t.danger} /> : null}
            </Pressable>
          </Card>
        </Reveal>

        <Reveal i={5} reduce={reduce}>
          <Text style={[styles.version, { color: t.textTer }]}>LOGOS · Frontend build</Text>
        </Reveal>
      </ScrollView>
    </ScreenBackground>
  );
}

function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 60).duration(420)}>{children}</Animated.View>;
}

function SectionTitle({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return <Text style={[styles.sectionTitle, { color: t.textSec }]}>{label.toUpperCase()}</Text>;
}

function NotifRow({
  icon,
  title,
  sub,
  value,
  onToggle,
  t,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  t: ReturnType<typeof useTheme>;
  last?: boolean;
}) {
  return (
    <View style={[styles.notifRow, { borderBottomColor: t.border }, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={20} color={t.accent} />
      <View style={styles.notifText}>
        <Text style={[styles.notifTitle, { color: t.text }]}>{title}</Text>
        <Text style={[styles.notifSub, { color: t.textSec }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: t.bgTer, true: t.accent }}
        thumbColor={t.text}
        ios_backgroundColor={t.bgTer}
      />
    </View>
  );
}

// 24h → friendly 12h label, e.g. 20 → "8:00 PM".
function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  roundBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topBarSpacer: { width: 42, height: 42 },
  title: { fontFamily: FONTS.uiBold, fontSize: 18 },
  sectionTitle: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginTop: 14, marginBottom: 10, marginLeft: 4 },

  themePicker: { flexDirection: 'row', padding: 6, gap: 4 },
  themeOption: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 0, borderWidth: 1 },
  themeLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 12 },

  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notifText: { flex: 1, gap: 2 },
  notifTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  notifSub: { fontFamily: FONTS.uiRegular, fontSize: 12 },
  hourRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hourLabel: { fontFamily: FONTS.uiMedium, fontSize: 14 },
  hourStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hourBtn: { width: 34, height: 34, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hourValue: { fontFamily: FONTS.mono, fontSize: 14, minWidth: 76, textAlign: 'center' },

  profileInputs: { gap: 18 },
  avatarRow: { alignItems: 'center', alignSelf: 'center', gap: 8 },
  avatarBox: { width: 80, height: 80 },
  avatar: { width: 80, height: 80, borderRadius: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBadge: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarHint: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: FONTS.uiMedium, fontSize: 12, letterSpacing: 0.3 },
  usernameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  atSign: { fontFamily: FONTS.uiSemiBold, fontSize: 17, paddingBottom: 8 },
  input: {
    fontFamily: FONTS.uiSemiBold, fontSize: 17, paddingBottom: 8, paddingTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  usernameInput: { flex: 1 },
  bioInput: {
    minHeight: 72, borderRadius: 0, borderWidth: 1, padding: 12, marginTop: 4,
    fontFamily: FONTS.uiMedium, fontSize: 15, textAlignVertical: 'top',
  },
  bioCount: { fontFamily: FONTS.mono, fontSize: 11, alignSelf: 'flex-end' },

  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 15 },

  version: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
