import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { TOTAL_STEPS, useOnboardingStore } from '@/stores/onboardingStore';
import { useReadingProjection } from '@/hooks/useReadingProjection';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { Stepper } from '@/components/onboarding/Stepper';
import { GoalProjectionCard } from '@/components/onboarding/GoalProjectionCard';

const PRESETS = [12, 24, 52];

// Goal screen: stepper + preset chips drive a live projection (Section 13).
// New users have no averages yet, so the projection uses defaults (300 pg/book,
// 60 PPH) and is labelled an estimate inside the card.
export default function Goal() {
  const t = useTheme();
  const router = useRouter();
  const { goalBooks, setGoalBooks } = useOnboardingStore();

  const projection = useReadingProjection(goalBooks);

  // Re-setting the same number marks the goal as confirmed, so resume can tell
  // an accepted default from a screen the reader never reached.
  const handleContinue = () => {
    setGoalBooks(goalBooks);
    router.push('/(onboarding)/profile' as Href);
  };

  return (
    <OnboardingScaffold
      step={3}
      totalSteps={TOTAL_STEPS}
      title="Set your reading goal"
      subtitle="How many books do you want to finish this year? You can change this anytime."
      scroll
      footer={<PrimaryButton label="Continue" onPress={handleContinue} />}
    >
      <View style={styles.body}>
        <Stepper value={goalBooks} onChange={setGoalBooks} min={1} max={365} unit="books / year" />

        <View style={styles.presets}>
          {PRESETS.map((p) => {
            const active = goalBooks === p;
            return (
              <Pressable
                key={p}
                onPress={() => setGoalBooks(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${p} books per year`}
                style={[
                  styles.preset,
                  { borderColor: active ? t.accent : t.border, backgroundColor: active ? 'rgba(255,61,31,0.12)' : 'transparent' },
                ]}
              >
                <Text style={[styles.presetText, { color: active ? t.accent : t.textSec }]}>
                  {presetLabel(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GoalProjectionCard projection={projection} />
        {projection.isEstimate ? (
          <Text style={[styles.estimate, { color: t.textTer }]}>
            Estimated — improves as you read.
          </Text>
        ) : null}
      </View>
    </OnboardingScaffold>
  );
}

function presetLabel(p: number): string {
  if (p === 12) return '1 / month';
  if (p === 52) return '1 / week';
  return `${p} / year`;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 16, gap: 24 },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  preset: { paddingHorizontal: 16, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presetText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  estimate: { fontFamily: FONTS.uiRegular, fontSize: 13, textAlign: 'center', marginTop: -12 },
});
