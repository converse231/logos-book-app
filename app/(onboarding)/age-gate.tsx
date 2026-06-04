import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { WheelPicker } from '@/components/onboarding/WheelPicker';

const CURRENT_YEAR = new Date().getFullYear();
// Oldest → youngest, but display youngest-first feels natural for a birth year.
const YEARS = Array.from({ length: 90 }, (_, i) => CURRENT_YEAR - 13 - i);
const DEFAULT_INDEX = 12; // ~25 years old

// COPPA age gate (blueprint Section 3 / 21). Under-13 → permanent blocked
// screen (no account). 13–17 → proceeds but flagged is_minor (no public
// reviews / social later). The picker only offers ages ≥13; the blocked state
// is reached via the explicit "I'm under 13" affordance.
export default function AgeGate() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const setBirthYear = useOnboardingStore((s) => s.setBirthYear);

  const [index, setIndex] = useState(DEFAULT_INDEX);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const birthYear = YEARS[index];
  const age = useMemo(() => CURRENT_YEAR - birthYear, [birthYear]);

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      const { isUnder13, isMinor } = await api.updateBirthYear(birthYear);
      if (isUnder13) {
        setBlocked(true);
        return;
      }
      setBirthYear(birthYear, isMinor);
      router.push('/(onboarding)/welcome');
    } finally {
      setSubmitting(false);
    }
  };

  if (blocked) {
    return <BlockedScreen />;
  }

  return (
    <OnboardingScaffold
      step={0}
      totalSteps={5}
      title="When were you born?"
      subtitle="Logos is for readers 13 and up. We only use this to keep things age-appropriate."
      footer={
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          loading={submitting}
        />
      }
    >
      <View style={styles.pickerArea}>
        <WheelPicker values={YEARS} selectedIndex={index} onChange={setIndex} />
        <Text style={[styles.ageHint, { color: t.textSec }]}>
          You're {age} years old
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

// Dead-end state for under-13. No forward path (COPPA).
function BlockedScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.blockedRoot,
        { backgroundColor: t.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={[styles.blockedIcon, { backgroundColor: t.bgSec }]}>
        <Ionicons name="lock-closed-outline" size={36} color={t.textSec} />
      </View>
      <Text style={[styles.blockedTitle, { color: t.text }]}>
        Come back when you're a little older
      </Text>
      <Text style={[styles.blockedBody, { color: t.textSec }]}>
        Logos is built for readers 13 and up. We can't create an account for you just yet — but
        your books will be waiting.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  ageHint: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  blockedRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 20 },
  blockedIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  blockedTitle: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  blockedBody: { fontFamily: FONTS.uiRegular, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
