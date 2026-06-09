import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useAppStore } from '@/stores/appStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
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
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // 2) Flush the buffered funnel choices as authenticated writes.
      await api.updateProfile({ displayName: trimmed, theme });
      await api.setGenrePrefs(genres);
      await api.setReadingGoal(new Date().getFullYear(), goalBooks);
      // 3) Mark onboarding done so the boot redirect lands on home next launch.
      await api.completeOnboarding();
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
        subtitle="Set your name and pick a theme. You can change both later in Settings."
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
            <TextInput
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              placeholder="At least 6 characters"
              placeholderTextColor={t.textTer}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="done"
              accessibilityLabel="Password"
              style={[styles.input, { backgroundColor: t.bgSec, color: t.text, borderColor: t.border }]}
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
