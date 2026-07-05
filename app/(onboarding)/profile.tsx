import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { track } from '@/lib/analytics';
import { useAppStore } from '@/stores/appStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { ThemeToggle } from '@/components/onboarding/ThemeToggle';

const NAME_RE = /^[A-Za-z0-9 _'-]{2,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Final onboarding step: name + theme + the account credentials (email-first,
// signup-last). This is where the account is actually created: signUp makes the
// auth user + public.users row from the buffered birth_year, then the buffered
// genres/goal/profile are flushed as authenticated writes, then completeOnboarding.
// All gamification stays server-side; this only persists identity + prefs.
export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const { theme, setTheme } = useAppStore();
  const { username, setUsername, birthYear, genres, goalBooks } = useOnboardingStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<{ uri: string; base64: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo access is needed to choose a picture. You can add one later in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setError(null);
      setAvatar({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
    }
  };

  const trimmed = username.trim();
  const nameValid = NAME_RE.test(trimmed);
  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 6;
  const valid = nameValid && emailValid && passwordValid;
  const showError = touched && trimmed.length > 0 && !nameValid;

  const handleFinish = async () => {
    setTouched(true);
    if (!valid || submitting) return;
    if (birthYear == null) {
      // Defensive: the age-gate should always have set this. Send them back.
      router.replace('/(onboarding)/age-gate' as Href);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1) Create the account (auth user + public.users row from birth_year).
      await api.signUp(email, password, birthYear);
      // 2) Upload the avatar (if picked) — non-fatal, never block onboarding on it.
      let avatarUrl: string | undefined;
      if (avatar?.base64) {
        try {
          avatarUrl = await api.uploadAvatar(avatar.base64);
        } catch {
          avatarUrl = undefined;
        }
      }
      // 3) Flush the buffered funnel choices as authenticated writes.
      await api.updateProfile({ displayName: trimmed, theme, avatarUrl });
      await api.setGenrePrefs(genres);
      await api.setReadingGoal(new Date().getFullYear(), goalBooks);
      // 4) Mark onboarding done so the boot redirect lands on home next launch.
      await api.completeOnboarding();
      track('onboarding_completed');
      // Cast: typed routes regenerate on first `expo start`; this is a valid route.
      router.replace('/(tabs)/home' as Href);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <OnboardingScaffold
        step={4}
        totalSteps={5}
        title="Last thing — who's reading?"
        subtitle="Add a photo, set your name, and pick a theme. You can change these later in Settings."
        onBack={() => router.back()}
        scroll
        footer={
          <PrimaryButton
            label="Start reading"
            onPress={handleFinish}
            loading={submitting}
            disabled={!valid}
          />
        }
      >
        <View style={styles.body}>
          {/* Profile photo (optional) */}
          <Pressable
            onPress={pickAvatar}
            accessibilityRole="button"
            accessibilityLabel={avatar ? 'Change profile photo' : 'Add a profile photo'}
            style={styles.avatarWrap}
          >
            <View style={styles.avatarBox}>
              <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Ionicons name="person" size={42} color={t.accent} />
                )}
              </View>
              <View style={[styles.avatarBadge, { backgroundColor: t.accent, borderColor: t.border }]}>
                <Ionicons name="camera" size={15} color={t.onAccent} />
              </View>
            </View>
            <Text style={[styles.avatarHint, { color: t.textSec }]}>
              {avatar ? 'CHANGE PHOTO' : 'ADD A PHOTO (OPTIONAL)'}
            </Text>
          </Pressable>

          {/* Name field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>YOUR NAME</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Alex"
              placeholderTextColor={t.textTer}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={24}
              accessibilityLabel="Your name"
              style={[
                styles.input,
                {
                  backgroundColor: t.bgSec,
                  color: t.text,
                  borderColor: showError ? t.danger : t.border,
                },
              ]}
            />
            {showError ? (
              <Text style={[styles.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
                Use 2–24 letters, numbers, spaces or _ - '
              </Text>
            ) : (
              <Text style={[styles.helper, { color: t.textTer }]}>
                This is how Logos will greet you.
              </Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
              placeholder="you@example.com"
              placeholderTextColor={t.textTer}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              accessibilityLabel="Email"
              style={[styles.input, { backgroundColor: t.bgSec, color: t.text, borderColor: t.border }]}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>PASSWORD</Text>
            <PasswordInput
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              placeholder="At least 6 characters"
              textContentType="newPassword"
              returnKeyType="done"
            />
            <Text style={[styles.helper, { color: t.textTer }]}>
              You'll use this to sign back in and keep your streak.
            </Text>
          </View>

          {/* Theme */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>APPEARANCE</Text>
            <ThemeToggle value={theme} onChange={setTheme} />
          </View>

          {error ? (
            <Text style={[styles.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
      </OnboardingScaffold>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 20, gap: 28 },
  avatarWrap: { alignItems: 'center', alignSelf: 'center', gap: 8 },
  avatarBox: { width: 96, height: 96 },
  avatar: {
    width: 96, height: 96, borderRadius: 0, borderWidth: BORDER_WIDTH,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBadge: {
    position: 'absolute', bottom: -6, right: -6, width: 32, height: 32, borderRadius: 0,
    borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1 },
  field: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  input: {
    minHeight: 52,
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium,
    fontSize: 17,
  },
  helper: { fontFamily: FONTS.uiRegular, fontSize: 13 },
});
