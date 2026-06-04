import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useAppStore } from '@/stores/appStore';
import { ThemePref, UserProfile } from '@/services/types';
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
  const [reminders, setReminders] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getProfile().then((p) => {
        if (!alive) return;
        setProfile(p);
        setDisplayName(p.displayName ?? '');
        setUsername(p.username ?? '');
      });
      return () => { alive = false; };
    }, [api])
  );

  const saveProfile = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName: displayName.trim(), username: username.trim() });
      setProfile(updated);
    } finally {
      setSaving(false);
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

  const dirty = profile && (displayName.trim() !== (profile.displayName ?? '') || username.trim() !== (profile.username ?? ''));

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
          <SectionTitle label="Reading reminders" t={t} />
          <Card padded style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="notifications-outline" size={20} color={t.accent} />
              <View style={styles.toggleText}>
                <Text style={[styles.toggleTitle, { color: t.text }]}>Daily reminder</Text>
                <Text style={[styles.toggleSub, { color: t.textSec }]}>Push notifications coming soon</Text>
              </View>
            </View>
            <Switch
              value={reminders}
              onValueChange={(v) => { Haptics.selectionAsync(); setReminders(v); }}
              trackColor={{ false: t.bgTer, true: t.accent }}
              thumbColor={t.text}
              ios_backgroundColor={t.bgTer}
              disabled
            />
          </Card>
        </Reveal>

        <Reveal i={2} reduce={reduce}>
          <SectionTitle label="Profile" t={t} />
          <Card padded style={styles.profileInputs}>
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
            {profile ? (
              <View style={[styles.menuRow, { borderBottomColor: t.border }]}>
                <Ionicons name="mail-outline" size={20} color={t.textSec} />
                <Text style={[styles.menuLabel, { color: t.text }]}>danielparagas5@gmail.com</Text>
              </View>
            ) : null}
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="log-out-outline" size={20} color={t.danger} />
              <Text style={[styles.menuLabel, { color: t.danger }]}>Sign out</Text>
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topBarSpacer: { width: 42, height: 42 },
  title: { fontFamily: FONTS.uiBold, fontSize: 18 },
  sectionTitle: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginTop: 14, marginBottom: 10, marginLeft: 4 },

  themePicker: { flexDirection: 'row', padding: 6, gap: 4 },
  themeOption: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  themeLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 12 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  toggleSub: { fontFamily: FONTS.uiRegular, fontSize: 12 },

  profileInputs: { gap: 18 },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: FONTS.uiMedium, fontSize: 12, letterSpacing: 0.3 },
  usernameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  atSign: { fontFamily: FONTS.uiSemiBold, fontSize: 17, paddingBottom: 8 },
  input: {
    fontFamily: FONTS.uiSemiBold, fontSize: 17, paddingBottom: 8, paddingTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  usernameInput: { flex: 1 },

  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 15 },

  version: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
