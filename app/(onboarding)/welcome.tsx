import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { TOTAL_STEPS } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { WelcomeStatCard } from '@/components/onboarding/WelcomeStatCard';
import { Q } from '@/components/shared/Q';

// RULE 1: lead with an animated mock stat card so the value is felt before any
// data exists. Framing copy makes clear the card is the user's own potential.
//
// This is the FIRST screen (it used to sit behind the age gate). A birth-year
// wheel as the opening impression is the highest-friction start possible, and
// COPPA only requires the gate before personal info is collected — this screen
// collects nothing, so the pitch gets to earn the question.
export default function Welcome() {
  const router = useRouter();
  const t = useTheme();
  return (
    <OnboardingScaffold
      step={0}
      totalSteps={TOTAL_STEPS}
      title="Before the book, there was the quire."
      // Trimmed to one line: the card's own "ONE YEAR FROM NOW" overline already
      // says what the numbers are, so the subtitle only has to say what Quire does.
      subtitle="Track every page you read."
      titleFont="display"
      footer={
        <View style={styles.footerStack}>
          <PrimaryButton
            label="This could be me"
            onPress={() => router.push('/(onboarding)/age-gate' as Href)}
          />
          {/* Entry screen now, so a returning reader needs the way out here. */}
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
        </View>
      }
    >
      <View style={styles.cardArea}>
        <WelcomeStatCard />
        {/* Was a two-line caption beside a 62px Q — on a small phone that plus the
            card plus a two-line subtitle left nothing breathing. One short line,
            small Q, centred. */}
        <View style={styles.captionRow}>
          <Q expression="waving" size={40} decorative />
          <Text style={[styles.caption, { color: t.textTer }]}>A preview — yours starts at zero.</Text>
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  footerStack: { gap: 14 },
  signInLink: { alignItems: 'center', paddingVertical: 2 },
  signInText: { fontFamily: FONTS.uiRegular, fontSize: 14 },
  cardArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  caption: { fontFamily: FONTS.uiRegular, fontSize: 13 },
});
