import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
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
import { AppleButton, useAppleAuthAvailable } from '@/components/auth/AppleButton';
import { KeyboardLift } from '@/components/shared/KeyboardLift';
import { openPrivacyPolicy } from '@/lib/legal';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A dropped connection surfaces as "TypeError: Network request failed" - say it in words.
const friendly = (e: any, fallback: string): string => {
  const msg: string = e?.message ?? '';
  if (/network|fetch|timed? ?out/i.test(msg)) return "You're offline. Check your connection and try again.";
  return msg || fallback;
};

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
  const [appling, setAppling] = useState(false);
  const appleAvailable = useAppleAuthAvailable();
  const socialBusy = googling || appling;
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
      router.replace('/(onboarding)/reader' as Href);
      return false;
    }
    return true;
  };

  // Shared tail: identical whichever provider created the account.
  const finish = async () => {
    /* AN ACCOUNT THAT ALREADY EXISTS IS SIGNED INTO, NOT RE-ONBOARDED (2026-10-15).
       A returning reader who taps through the funnel again (a reinstall, a new
       phone) and then picks Google, or types their existing email + password,
       lands here signed into their REAL account. Running complete_onboarding
       then replaced their name, genres and goal with the new answers, and the
       upload below overwrote their avatar file. Checked first, so neither runs. */
    const existing = await api.getProfile().catch(() => null);
    if (existing?.onboardingCompletedAt) {
      reset();
      router.replace('/(tabs)/home' as Href);
      return;
    }
    // Avatar first — it needs a session but not a profile row, and it's the one
    // step allowed to fail (a photo is never worth blocking signup).
    let avatarUrl: string | undefined;
    if (avatar?.base64) {
      try {
        avatarUrl = await api.uploadAvatar(avatar.base64);
      } catch (e) {
        console.warn('[onboarding] avatar upload failed', e);
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
    if (!canSubmit || submitting || socialBusy) return;
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
        setError(friendly(e, 'Could not create your account. Please try again.'));
      }
      await refreshAuthEmail();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting || socialBusy) return;
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
        setError(friendly(e, 'Could not sign up with Google. Try again.'));
      }
      // The attempt may still have left a session behind (the code exchange can
      // land before the browser reports back), so re-read rather than assume.
      await refreshAuthEmail();
    } finally {
      setGoogling(false);
    }
  };

  // Mirrors handleGoogle. guardFunnel runs first, and finish() goes through
  // completeOnboarding — so an Apple ID can't skip the age gate any more than a
  // Google one can, and a returning Apple reader is signed in, not re-onboarded.
  const handleApple = async () => {
    if (submitting || socialBusy) return;
    if (!guardFunnel()) return;
    setAppling(true);
    setError(null);
    setEmailTaken(false);
    try {
      await api.signInWithApple();
      await refreshAuthEmail();
      await finish();
    } catch (e: any) {
      if (e?.message === 'APPLE_CANCELLED') {
        setError('Apple sign-up cancelled. Try again, or use an email and password.');
      } else {
        setError(friendly(e, 'Could not sign up with Apple. Try again.'));
      }
      await refreshAuthEmail();
    } finally {
      setAppling(false);
    }
  };

  // Wrong Google account? Drop the session so the next attempt starts clean and
  // the chooser reappears. Without this the account chip was a dead end.
  const handleSwitchAccount = async () => {
    if (submitting || socialBusy) return;
    setError(null);
    try {
      await api.signOut();
    } catch {
      // Nothing to sign out of is fine — the point is the local session is gone.
    }
    setAuthEmail(null);
  };

  // On a small phone the pinned footer + heading + keyboard left no room for the
  // form, so readers typed their email and password blind. The footer now holds
  // only the primary action, and a focused field is scrolled to the top of what
  // is left. Scrolled twice: once now, and once after the keyboard has shrunk the
  // viewport — only then can the scroll view reach an offset that far down.
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const fieldY = useRef<Record<'email' | 'password', number>>({ email: 0, password: 0 });
  const reveal = (field: 'email' | 'password') => {
    const go = () => scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + fieldY.current[field] - 12), animated: true });
    go();
    setTimeout(go, 320);
  };

  return (
    <KeyboardLift style={styles.flex}>
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
        scrollRef={scrollRef}
        footer={
          <View style={styles.footerStack}>
            {/* "Start reading" only — the longer label wrapped to two lines and
                the surrounding copy already says this creates an account. */}
            <PrimaryButton
              label="Start reading"
              onPress={handleEmailSignUp}
              loading={submitting}
              disabled={!canSubmit || socialBusy}
            />
          </View>
        }
      >
        <View style={styles.body} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
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
                {/* Not the Google logo: an email signup whose last step failed (a
                    network blip) lands here too, and was told to sign back in
                    with Google. The screen only knows the address, so it says that. */}
                <Ionicons name="person-circle-outline" size={18} color={t.text} />
                <Text style={[styles.signedInText, { color: t.text }]} numberOfLines={1}>
                  {/* "Hide My Email" gives a random relay address the reader has
                      never seen — naming the account is clearer than showing it. */}
                  {/@privaterelay\.appleid\.com$/i.test(authEmail) ? 'Your Apple ID' : authEmail}
                </Text>
                <Ionicons name="checkmark-circle" size={17} color={t.accentText} />
              </View>
              <View style={styles.accountRow}>
                <Text style={[styles.helper, { color: t.textTer, flex: 1 }]}>
                  Your shelf, streak and goal will be saved to this account.
                </Text>
                <Pressable
                  onPress={handleSwitchAccount}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Use a different account"
                >
                  <Text style={[styles.switchAccount, { color: t.accentText }]}>
                    Use a different account
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.field} onLayout={(e) => { fieldY.current.email = e.nativeEvent.layout.y; }}>
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
                  onFocus={() => reveal('email')}
                  accessibilityLabel="Email"
                  style={[
                    styles.input,
                    { backgroundColor: t.bgSec, color: t.text, borderColor: emailTaken ? t.danger : t.border },
                  ]}
                />
              </View>

              <View style={styles.field} onLayout={(e) => { fieldY.current.password = e.nativeEvent.layout.y; }}>
                <Text style={[styles.label, { color: t.textSec }]}>PASSWORD</Text>
                <PasswordInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  placeholder="At least 6 characters"
                  textContentType="newPassword"
                  onFocus={() => reveal('password')}
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
                  <Text style={[styles.switchAccount, { color: t.accentText }]}>
                    Sign in to that account instead
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Hidden once authenticated: you can't sign up with Google twice,
              and being asked to is what made this step feel broken. */}
          {!authEmail ? (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
                <Text style={[styles.dividerText, { color: t.textTer }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: t.textTer }]} />
              </View>
              {/* Apple first: Guideline 4.8 wants it at least as prominent as Google. */}
              {appleAvailable ? (
                <AppleButton onPress={handleApple} loading={appling} disabled={submitting || googling} />
              ) : null}
              <GoogleButton onPress={handleGoogle} loading={googling} disabled={submitting || appling} />
              <Pressable
                onPress={() => router.push('/(auth)/sign-in' as Href)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sign in to an existing account"
                style={styles.signInLink}
              >
                <Text style={[styles.signInText, { color: t.textSec }]}>
                  Already have an account?{' '}
                  <Text style={{ color: t.accentText, fontFamily: FONTS.uiBold }}>Sign in</Text>
                </Text>
              </Pressable>
            </>
          ) : null}

          {/* Shown whichever way the account is made — this is the step where a
              reader hands over an email, so it is where the policy belongs. */}
          <Pressable
            onPress={openPrivacyPolicy}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel="Read the privacy policy"
            accessibilityHint="Opens in your browser"
            style={styles.privacyLink}
          >
            <Text style={[styles.privacyText, { color: t.textTer }]}>
              How we handle your data:{' '}
              <Text style={{ color: t.accentText, fontFamily: FONTS.uiBold }}>Privacy policy</Text>
            </Text>
          </Pressable>
        </View>
      </OnboardingScaffold>
    </KeyboardLift>
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
  dividerText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.4 },
  signInLink: { alignItems: 'center', paddingVertical: 2 },
  signInText: { fontFamily: FONTS.uiRegular, fontSize: 14 },
  privacyLink: { alignItems: 'center', paddingVertical: 2 },
  privacyText: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  field: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  input: {
    minHeight: 52, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium, fontSize: 17,
  },
  helper: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  errorBlock: { gap: 8 },
});
