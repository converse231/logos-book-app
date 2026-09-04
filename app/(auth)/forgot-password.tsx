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
import { KeyboardLift } from '@/components/shared/KeyboardLift';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Forgot-password (B2, email-first). OTP-code flow — resetPasswordForEmail sends a
// 6-digit recovery code, verifyOtp + updateUser sets the new password — so it works
// in Expo Go without the deep-link round-trip a reset LINK would need (that lands
// with the dev build at B5). Two phases on one screen: request → confirm.
export default function ForgotPassword() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  // Supabase's email OTP length is configurable (6–10); accept any in range
  // rather than hardcode one, so a project-level OTP-length change never breaks this.
  const confirmValid = code.trim().length >= 6 && password.length >= 6;

  const sendCode = async () => {
    if (!emailValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setNotice(`We emailed a reset code to ${email.trim()}.`);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send a reset code. Check the email and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReset = async () => {
    if (!confirmValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.resetPassword(email, code, password);
      router.replace('/(tabs)/home' as Href);
    } catch (e: any) {
      setError(e?.message ?? 'That code was invalid or expired. Request a new one.');
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
            onPress={() => (sent ? setSent(false) : router.back())}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>RESET PASSWORD</Text>
            <Text style={[styles.subtitle, { color: t.textSec }]}>
              {sent
                ? notice ?? 'Enter the code we emailed you and pick a new password.'
                : 'Enter your email and we’ll send you a reset code.'}
            </Text>
          </View>

          <View style={styles.form}>
            {!sent ? (
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
                  returnKeyType="go"
                  onSubmitEditing={sendCode}
                  accessibilityLabel="Email"
                  style={[styles.input, { backgroundColor: t.bgSec, color: t.text, borderColor: t.border }]}
                />
              </View>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: t.textSec }]}>RESET CODE</Text>
                  <TextInput
                    value={code}
                    onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                    placeholder="12345678"
                    placeholderTextColor={t.textTer}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    returnKeyType="next"
                    accessibilityLabel="Reset code from your email"
                    style={[styles.input, styles.codeInput, { backgroundColor: t.bgSec, color: t.text, borderColor: t.border }]}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: t.textSec }]}>NEW PASSWORD</Text>
                  <PasswordInput
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(null); }}
                    placeholder="At least 6 characters"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={confirmReset}
                    accessibilityLabel="New password"
                  />
                </View>
              </>
            )}

            {error ? (
              <Text style={[styles.error, { color: t.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            {!sent ? (
              <PrimaryButton label="Send reset code" onPress={sendCode} loading={submitting} disabled={!emailValid} />
            ) : (
              <>
                <PrimaryButton label="Reset password" onPress={confirmReset} loading={submitting} disabled={!confirmValid} />
                <Pressable
                  onPress={sendCode}
                  hitSlop={8}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Resend the code"
                  style={styles.altLink}
                >
                  <Text style={[styles.altText, { color: t.textSec }]}>
                    Didn’t get it? <Text style={{ color: t.accent, fontFamily: FONTS.uiBold }}>Resend code</Text>
                  </Text>
                </Pressable>
              </>
            )}
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
  codeInput: { letterSpacing: 6, fontFamily: FONTS.mono, fontSize: 20 },
  error: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  footer: { marginTop: 'auto', gap: 16 },
  altLink: { alignItems: 'center', paddingVertical: 4 },
  altText: { fontFamily: FONTS.uiRegular, fontSize: 14 },
});
