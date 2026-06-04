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

// Final onboarding step: name + theme. Inline validation on blur (UX
// `inline-validation`); theme previews live via appStore. On submit →
// persist + completeOnboarding → replace to home (no back into onboarding).
export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const { theme, setTheme } = useAppStore();
  const { username, setUsername } = useOnboardingStore();

  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = username.trim();
  const valid = NAME_RE.test(trimmed);
  const showError = touched && trimmed.length > 0 && !valid;

  const handleFinish = async () => {
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    try {
      await api.updateProfile({ displayName: trimmed, theme });
      await api.completeOnboarding();
      // Cast: typed routes regenerate on first `expo start`; this is a valid route.
      router.replace('/(tabs)/home' as Href);
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

          {/* Theme */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>APPEARANCE</Text>
            <ThemeToggle value={theme} onChange={setTheme} />
          </View>
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
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium,
    fontSize: 17,
  },
  helper: { fontFamily: FONTS.uiRegular, fontSize: 13 },
});
