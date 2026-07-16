import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { WelcomeStatCard } from '@/components/onboarding/WelcomeStatCard';
import { Mascot } from '@/components/shared/Mascot';

// RULE 1: lead with an animated mock stat card so the value is felt before any
// data exists. Framing copy makes clear the card is the user's own potential.
export default function Welcome() {
  const router = useRouter();
  const t = useTheme();
  return (
    <OnboardingScaffold
      step={1}
      totalSteps={5}
      title="In the beginning was the Word."
      subtitle="Track every one you read. Here's where a single year of reading with Logos can take you."
      titleFont="display"
      onBack={() => router.back()}
      footer={
        <PrimaryButton label="This could be me" onPress={() => router.push('/(onboarding)/genres')} />
      }
    >
      <View style={styles.cardArea}>
        <WelcomeStatCard />
        <View style={styles.captionRow}>
          <Mascot size={54} />
          <Text style={[styles.caption, { color: t.textSec }]}>
            A preview, not real numbers — yet. Every page you log makes it yours.
          </Text>
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  cardArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  caption: { flex: 1, fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
});
