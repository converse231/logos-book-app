import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleProp, StyleSheet, Switch,
  Text, TextInput, View, ViewStyle,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon, type IconTint } from '@/components/shared/AppIcon';
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
import { Reveal } from '@/components/shared/Reveal';

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
      }).catch(() => {});
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
        automaticallyAdjustKeyboardInsets
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

        <Reveal index={0}>
          <SectionTitle label="Appearance" t={t} />
          <Card padded={false}>
            <ThemeSegment value={themePref} onChange={setThemePref} t={t} />
          </Card>
        </Reveal>

        <Reveal index={1}>
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
                  // Ember, not coral: the streak owns that hue everywhere else in
                  // the app, and this row is about the streak.
                  tint="ember"
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

        <Reveal index={2}>
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
                    <AppIcon name="person" tint="accent" size={34} />
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

        <Reveal index={3}>
          <SectionTitle label="Goal" t={t} />
          <Card padded={false}>
            <Pressable
              onPress={() => router.push('/(modals)/goal-edit' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Edit reading goal"
              style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              {/* The gold flag was drawn for the reading goal — gold owns goals and
                  XP in this palette, so it belongs here more than the coral did. */}
              <AppIcon name="flag" tint="gold" size={20} color={t.accent} />
              <Text style={[styles.menuLabel, { color: t.text }]}>Edit reading goal</Text>
              <Ionicons name="chevron-forward" size={18} color={t.textTer} />
            </Pressable>
          </Card>
        </Reveal>

        <Reveal index={4}>
          <SectionTitle label="Account" t={t} />
          <Card padded={false}>
            {profile?.email ? (
              <View style={[styles.menuRow, { borderBottomColor: t.border }]}>
                <AppIcon name="mail" tint="muted" size={20} color={t.textSec} />
                <Text style={[styles.menuLabel, { color: t.text }]} numberOfLines={1}>{profile.email}</Text>
              </View>
            ) : null}
            {/* Moderation queue. The link is hidden for everyone else, but RLS is
                the real gate — this is convenience, not security. */}
            {profile?.isAdmin ? (
              <Pressable
                onPress={() => router.push('/(tabs)/profile/moderation' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Reported reviews"
                style={({ pressed }) => [styles.menuRow, { borderBottomColor: t.border }, pressed && { opacity: 0.7 }]}
              >
                <AppIcon name="flag-outline" tint="muted" size={20} color={t.textSec} />
                <Text style={[styles.menuLabel, { color: t.text }]}>Reported reviews</Text>
                <Ionicons name="chevron-forward" size={18} color={t.textTer} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={exportData}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Export my data"
              style={({ pressed }) => [styles.menuRow, { borderBottomColor: t.border }, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="download" tint="muted" size={20} color={t.textSec} />
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
              <AppIcon name="log-out" tint="muted" size={20} color={t.text} />
              <Text style={[styles.menuLabel, { color: t.text }]}>Sign out</Text>
            </Pressable>
            <Pressable
              onPress={deleteAccount}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <AppIcon name="trash" tint="danger" size={20} />
              <Text style={[styles.menuLabel, { color: t.danger }]}>
                {busy === 'delete' ? 'Deleting…' : 'Delete account'}
              </Text>
              {busy === 'delete' ? <ActivityIndicator size="small" color={t.danger} /> : null}
            </Pressable>
          </Card>
        </Reveal>

        <Reveal index={5}>
          <Text style={[styles.version, { color: t.textTer }]}>Quire · Frontend build</Text>
        </Reveal>
      </ScrollView>
    </ScreenBackground>
  );
}


function SectionTitle({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return <Text style={[styles.sectionTitle, { color: t.textSec }]}>{label.toUpperCase()}</Text>;
}

/**
 * Dark / Light / System, with the selection SLIDING between cells.
 *
 * One shared value drives everything: the coral pill's position and all three
 * cells' colours. That's what keeps them in sync — the label warms up as the pill
 * arrives under it rather than snapping the instant you tap.
 *
 * 170ms ease-out, no overshoot. You can see which direction the selection
 * travelled, which a crossfade never tells you, but the pill doesn't bounce —
 * this is a setting, not a reward.
 *
 * Each icon is drawn TWICE, muted under accent, and cross-faded. A font glyph
 * could have had its colour interpolated instead, but painted art can't be
 * tinted at runtime — so when hand-drawn moon/sun/phone icons land, this needs
 * no rework.
 */
function ThemeSegment({
  value,
  onChange,
  t,
}: {
  value: ThemePref;
  onChange: (v: ThemePref) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, THEME_OPTIONS.findIndex((o) => o.key === value));
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = reduce ? index : withTiming(index, { duration: 170, easing: Easing.out(Easing.cubic) });
  }, [index, reduce, pos]);

  const cell = width / THEME_OPTIONS.length;
  const thumbStyle = useAnimatedStyle(() => ({
    width: cell,
    transform: [{ translateX: pos.value * cell }],
  }));

  return (
    // The padding sits on an OUTER view so the row itself is the thumb's
    // containing block — a padded parent makes an absolute child's origin
    // ambiguous, and this pill has to land on an exact third.
    <View style={styles.themePickerPad}>
      <View style={styles.themePicker} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.themeThumb, { backgroundColor: t.accentMuted, borderColor: t.accent }, thumbStyle]}
        />
      ) : null}
      {THEME_OPTIONS.map((opt, i) => (
        <Pressable
          key={opt.key}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(opt.key);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: i === index }}
          accessibilityLabel={opt.label}
          style={styles.themeOption}
        >
          <View style={styles.themeIcon}>
            {/* One drawing, not two: unlike the label, the icon doesn't change
                colour with selection — the coral pill behind it is what says
                which one is on. Coral art with its own ink outline reads on the
                pill AND on the bare card, which is what let the dark-mode font
                fallback go away. */}
            <AppIcon name={opt.icon} tint="accent" size={22} color={t.textSec} />
          </View>
          <View>
            <Text style={[styles.themeLabel, { color: t.textSec }]}>{opt.label}</Text>
            <Fade pos={pos} i={i} style={StyleSheet.absoluteFill}>
              <Text style={[styles.themeLabel, { color: t.accent }]}>{opt.label}</Text>
            </Fade>
          </View>
        </Pressable>
      ))}
      </View>
    </View>
  );
}

/** Fully visible when the pill is under cell `i`, gone by the time it reaches the
 *  next one — so the two colours cross over exactly as the pill passes. */
function Fade({
  pos,
  i,
  style,
  children,
}: {
  pos: SharedValue<number>;
  i: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const anim = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(pos.value - i)) }));
  return (
    <Animated.View pointerEvents="none" style={[style, anim]}>
      {children}
    </Animated.View>
  );
}

function NotifRow({
  icon,
  tint,
  title,
  sub,
  value,
  onToggle,
  t,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** Which painted variant to ask for. AppIcon falls back to the font glyph when
   *  that art doesn't exist, so a row upgrades the moment its file lands. */
  tint?: IconTint;
  title: string;
  sub: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  t: ReturnType<typeof useTheme>;
  last?: boolean;
}) {
  return (
    <View style={[styles.notifRow, { borderBottomColor: t.border }, last && { borderBottomWidth: 0 }]}>
      <AppIcon name={icon} tint={tint ?? 'accent'} size={20} color={t.accent} />
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
  roundBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topBarSpacer: { width: 42, height: 42 },
  title: { fontFamily: FONTS.uiBold, fontSize: 18 },
  sectionTitle: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginTop: 14, marginBottom: 10, marginLeft: 4 },

  themePickerPad: { padding: 6 },
  // No `gap` here: the pill is positioned in thirds of the row's width, so a gap
  // between cells would put it slightly off-centre on the outer two.
  themePicker: { flexDirection: 'row' },
  themeThumb: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 1 },
  themeOption: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14 },
  themeIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  hourBtn: { width: 34, height: 34, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hourValue: { fontFamily: FONTS.mono, fontSize: 14, minWidth: 76, textAlign: 'center' },

  profileInputs: { gap: 18 },
  avatarRow: { alignItems: 'center', alignSelf: 'center', gap: 8 },
  avatarBox: { width: 80, height: 80 },
  avatar: { width: 80, height: 80, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBadge: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
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
    minHeight: 72, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4,
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
