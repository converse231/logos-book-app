import { useCallback, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { AppIcon, type IconTint } from '@/components/shared/AppIcon';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK, RADIUS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { track } from '@/lib/analytics';
import { useAppStore } from '@/stores/appStore';
import { TOTAL_STEPS, useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { GoogleButton } from '@/components/auth/GoogleButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 6 of 6 — the ONLY thing this screen does is get the reader an account,
// then flush the buffered funnel through the single `complete_onboarding` RPC.
//
// Split out of the old profile step, which collected identity, credentials,
// Google and theme all at once while also creating the account. Auth deserves
// its own screen: it's the one step that can fail for reasons the reader has to
// act on (address taken, cancelled Google, no network).
export default function Account() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const theme = useAppStore((s) => s.theme);
  const { birthYear, genres, goalBooks, username, avatar, reset } = useOnboardingStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googling, setGoogling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  // Non-null when the reader is ALREADY authenticated — Google from here, or a
  // session left over from a prior attempt. Asking such a reader for an email
  // and password is nonsense: they don't have one to give.
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const refreshAuthEmail = useCallback(
    async () => setAuthEmail(await api.getAuthEmail().catch(() => null)),
    [api]
  );
  useEffect(() => {
    refreshAuthEmail();
  }, [refreshAuthEmail]);

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = authEmail ? true : emailValid && passwordValid;

  // The funnel must be complete before an account is worth creating. Anything
  // missing means the reader arrived here out of order (a killed process, a
  // stale deep link) — send them back to the gap rather than provisioning a
  // half-empty account, which is exactly the bug this revamp exists to kill.
  const guardFunnel = (): boolean => {
    if (birthYear == null) {
      router.replace('/(onboarding)/age-gate' as Href);
      return false;
    }
    if (!username.trim()) {
      router.replace('/(onboarding)/profile' as Href);
      return false;
    }
    return true;
  };

  // Shared tail: identical whichever provider created the account.
  const finish = async () => {
    // Avatar first — it needs a session but not a profile row, and it's the one
    // step allowed to fail silently (a photo is never worth blocking signup).
    let avatarUrl: string | undefined;
    if (avatar?.base64) {
      try {
        avatarUrl = await api.uploadAvatar(avatar.base64);
      } catch {
        avatarUrl = undefined;
      }
    }
    // One transaction: identity + genres + goal + completion stamp.
    await api.completeOnboarding({
      birthYear: birthYear!,
      displayName: username.trim(),
      genres,
      goalBooks,
      theme,
      avatarUrl,
    });
    reset(); // persisted store — don't leak these answers into the next account
    track('onboarding_completed');
    router.replace('/(tabs)/home' as Href);
  };

  const handleEmailSignUp = async () => {
    if (!canSubmit || submitting || googling) return;
    if (!guardFunnel()) return;
    setSubmitting(true);
    setError(null);
    setEmailTaken(false);
    try {
      if (!authEmail) await api.signUp(email.trim(), password);
      await finish();
    } catch (e: any) {
      if (e?.message === 'EMAIL_IN_USE') {
        setEmailTaken(true);
        setError('That email already has a Quire account.');
      } else {
        setError(e?.message ?? 'Could not create your account. Please try again.');
      }
      await refreshAuthEmail();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting || googling) return;
    if (!guardFunnel()) return;
    setGoogling(true);
    setError(null);
    setEmailTaken(false);
    try {
      await api.signInWithGoogle();
      await refreshAuthEmail();
      await finish();
    } catch (e: any) {
      if (e?.message === 'GOOGLE_CANCELLED') {
        // Backing out used to do NOTHING — no message, no state change — so the
        // button read as broken and readers reached for the other one instead.
        setError('Google sign-up cancelled. Try again, or use an email and password.');
      } else {
        setError(e?.message ?? 'Could not sign up with Google. Try again.');
      }
      // The attempt may still have left a session behind (the code exchange can
      // land before the browser reports back), so re-read rather than assume.
      await refreshAuthEmail();
    } finally {
      setGoogling(false);
    }
  };

  // Wrong Google account? Drop the session so the next attempt starts clean and
  // the chooser reappears. Without this the account chip was a dead end.
  const handleSwitchAccount = async () => {
    if (submitting || googling) return;
    setError(null);
    try {
      await api.signOut();
    } catch {
      // Nothing to sign out of is fine — the point is the local session is gone.
    }
    setAuthEmail(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <OnboardingScaffold
        step={5}
        totalSteps={TOTAL_STEPS}
        title={authEmail ? 'You’re all set' : 'Save your progress'}
        subtitle={
          authEmail
            ? 'One tap and your shelf, streak and goal are yours.'
            : 'An account keeps your streak, goal and library safe across devices.'
        }
        scroll
        footer={
          <View style={styles.footerStack}>
            {/* "Start reading" only — the longer label wrapped to two lines and
                the surrounding copy already says this creates an account. */}
            <PrimaryButton
              label="Start reading"
              onPress={handleEmailSignUp}
              loading={submitting}
              disabled={!canSubmit || googling}
            />

            {/* Hidden once authenticated: you can't sign up with Google twice,
                and being asked to is what made this step feel broken. */}
            {!authEmail ? (
              <>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
                  <Text style={[styles.dividerText, { color: t.textTer }]}>OR</Text>
                  <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
                </View>
                <GoogleButton onPress={handleGoogle} loading={googling} disabled={submitting} />
                <Pressable
                  onPress={() => router.push('/(auth)/sign-in' as Href)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to an existing account"
                  style={styles.signInLink}
                >
                  <Text style={[styles.signInText, { color: t.textSec }]}>
                    Already have an account?{' '}
                    <Text style={{ color: t.accent, fontFamily: FONTS.uiBold }}>Sign in</Text>
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        }
      >
        <View style={styles.body}>
          {/* What they're about to keep — the funnel answers, made concrete. */}
          <View style={[styles.summary, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <SummaryRow icon="person" tint="accent" label="Name" value={username.trim()} t={t} />
            <SummaryRow
              icon="bookmarks"
              tint="accent"
              label="Genres"
              value={genres.length ? `${genres.slice(0, 2).join(', ')}${genres.length > 2 ? ` +${genres.length - 2}` : ''}` : '—'}
              t={t}
            />
            <SummaryRow icon="flag" tint="gold" label="Goal" value={`${goalBooks} books this year`} t={t} />
          </View>

          {authEmail ? (
            /* Already authenticated — there's no password to set, so confirm
               WHICH account this is instead of asking for credentials. */
            <View style={styles.field}>
              <Text style={[styles.label, { color: t.textSec }]}>ACCOUNT</Text>
              <View style={[styles.signedIn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
                <Ionicons name="logo-google" size={17} color={t.text} />
                <Text style={[styles.signedInText, { color: t.text }]} numberOfLines={1}>
                  {authEmail}
                </Text>
                <Ionicons name="checkmark-circle" size={17} color={t.accent} />
              </View>
              <View style={styles.accountRow}>
                <Text style={[styles.helper, { color: t.textTer, flex: 1 }]}>
                  You&rsquo;ll sign back in with Google.
                </Text>
                <Pressable
                  onPress={handleSwitchAccount}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Use a different account"
                >
                  <Text style={[styles.switchAccount, { color: t.accent }]}>
                    Use a different account
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={[styles.label, { color: t.textSec }]}>EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); setEmailTaken(false); }}
                  placeholder="you@example.com"
                  placeholderTextColor={t.textTer}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  accessibilityLabel="Email"
                  style={[
                    styles.input,
                    { backgroundColor: t.bgSec, color: t.text, borderColor: emailTaken ? t.danger : t.border },
                  ]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: t.textSec }]}>PASSWORD</Text>
                <PasswordInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  placeholder="At least 6 characters"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleEmailSignUp}
                />
                <Text style={[styles.helper, { color: t.textTer }]}>
                  You&rsquo;ll use this to sign back in and keep your streak.
                </Text>
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
              {/* The dead end an orphaned half-signup used to leave behind: the
                  address is taken and this password doesn't open it. */}
              {emailTaken ? (
                <Pressable
                  onPress={() => router.push('/(auth)/sign-in' as Href)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to that account instead"
                >
                  <Text style={[styles.switchAccount, { color: t.accent }]}>
                    Sign in to that account instead
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </OnboardingScaffold>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({
  icon,
  tint,
  label,
  value,
  t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: IconTint;
  label: string;
  value: string;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.summaryRow}>
      {/* Hand-drawn art from assets/ui-icons via AppIcon, not a font glyph. */}
      <AppIcon name={icon} tint={tint} size={18} />
      <Text style={[styles.summaryLabel, { color: t.textSec }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: t.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footerStack: { gap: 12 },
  body: { paddingHorizontal: 24, paddingTop: 20, gap: 24 },
  summary: {
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md, padding: 16, gap: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.1, width: 62 },
  summaryValue: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14, textAlign: 'right' },
  signedIn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    minHeight: 52, borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
  },
  signedInText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchAccount: { fontFamily: FONTS.uiBold, fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, opacity: 0.4 },
  dividerText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.4 },
  signInLink: { alignItems: 'center', paddingVertical: 2 },
  signInText: { fontFamily: FONTS.uiRegular, fontSize: 14 },
  field: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  input: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium, fontSize: 17,
  },
  helper: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  errorBlock: { gap: 8 },
});
