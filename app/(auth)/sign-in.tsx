import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { KeyboardLift } from '@/components/shared/KeyboardLift';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returning-user sign-in (B2, email-first). New users go through the onboarding
// funnel (which ends in sign-up); this is reached from the "Already have an
// account?" link on the age-gate. On success the root boot redirect (app/index)
// reacts to the auth-state change and routes to home.
export default function SignIn() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googling, setGoogling] = useState(false);

  const valid = EMAIL_RE.test(email.trim()) && password.length >= 6;

  // Sign-in never creates a profile — signInWithGoogle only authenticates, and
  // `complete_onboarding` is the sole thing that can write public.users. A Google
  // account that has never onboarded therefore lands authenticated but
  // profile-less, and the boot redirect (app/index.tsx) drops it back into the
  // funnel at the first unanswered step. The account step recognises the existing
  // session and asks for nothing but confirmation.
  //
  // So this button is safe for new users, not just returning ones — it can't skip
  // the age gate, which is what keeps COPPA intact.
  const handleGoogle = async () => {
    if (submitting || googling) return;
    setGoogling(true);
    setError(null);
    try {
      await api.signInWithGoogle();
      router.replace('/' as Href); // boot redirect decides: home, or finish onboarding
    } catch (e: any) {
      // Backing out of the browser is a choice, not a failure.
      if (e?.message !== 'GOOGLE_CANCELLED') {
        setError(e?.message ?? 'Could not sign in with Google. Try again.');
      }
    } finally {
      setGoogling(false);
    }
  };

  const handleSignIn = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.signIn(email, password);
      router.replace('/(tabs)/home' as Href);
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardLift style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>WELCOME BACK</Text>
            <Text style={[styles.subtitle, { color: t.textSec }]}>
              Sign in to pick up your streak where you left off.
            </Text>
          </View>

          <View style={styles.form}>
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

            <View style={styles.field}>
              <Text style={[styles.label, { color: t.textSec }]}>PASSWORD</Text>
              <PasswordInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                placeholder="Your password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password' as Href)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Forgot your password?"
                style={styles.forgot}
              >
                <Text style={[styles.forgotText, { color: t.accent }]}>Forgot password?</Text>
              </Pressable>
            </View>

            {error ? (
              <Text style={[styles.error, { color: t.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            <PrimaryButton label="Sign in" onPress={handleSignIn} loading={submitting} disabled={!valid || googling} />

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
              <Text style={[styles.dividerText, { color: t.textTer }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
            </View>

            <GoogleButton
              label="Sign in with Google"
              onPress={handleGoogle}
              loading={googling}
              disabled={submitting}
            />
            <Pressable
              onPress={() => router.replace('/(onboarding)/welcome' as Href)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Create a new account"
              style={styles.altLink}
            >
              <Text style={[styles.altText, { color: t.textSec }]}>
                New to Quire? <Text style={{ color: t.accent, fontFamily: FONTS.uiBold }}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardLift>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  backBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 10 },
  title: { fontFamily: FONTS.displayBold, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 16, lineHeight: 22 },
  form: { gap: 20 },
  field: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  input: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium, fontSize: 17,
  },
  error: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  footer: { marginTop: 'auto', gap: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dividerLine: { flex: 1, height: 1, opacity: 0.4 },
  dividerText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.4 },
  altLink: { alignItems: 'center', paddingVertical: 4 },
  altText: { fontFamily: FONTS.uiRegular, fontSize: 14 },
});
