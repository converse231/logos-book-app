import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { MIN_GENRES, TOTAL_STEPS, useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { GenreChip } from '@/components/onboarding/GenreChip';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Romance', 'Thriller',
  'Mystery', 'Literary Fiction', 'Historical', 'Horror', 'Spirituality',
  'Psychology', 'Self-Help', 'Biography', 'Philosophy', 'Poetry',
  'Business', 'Science', 'Young Adult', 'Classics',
];

// RULE 2: mirror the user's picks back in the subtitle so the selection feels
// seen ("You're into Fantasy & Sci-Fi…"). Requires ≥2 genres before continuing.
//
// Buffers to the store only — there is no account yet, and the whole funnel is
// flushed in one transaction at the account step.
export default function Genres() {
  const t = useTheme();
  const router = useRouter();
  const { genres, toggleGenre } = useOnboardingStore();

  const subtitle = useMemo(() => mirrorBack(genres), [genres]);
  const canContinue = genres.length >= MIN_GENRES;

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={TOTAL_STEPS}
      title="What do you love to read?"
      subtitle={subtitle}
      scroll
      footer={
        <>
          <Text style={[styles.counter, { color: canContinue ? t.accent : t.textSec }]}>
            {genres.length} selected{!canContinue ? ` · pick ${MIN_GENRES - genres.length} more` : ''}
          </Text>
          <PrimaryButton
            label="Continue"
            onPress={() => router.push('/(onboarding)/goal' as Href)}
            disabled={!canContinue}
          />
        </>
      }
    >
      <View style={styles.grid}>
        {GENRES.map((g) => (
          <GenreChip
            key={g}
            label={g}
            selected={genres.includes(g)}
            onToggle={() => toggleGenre(g)}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}

function mirrorBack(genres: string[]): string {
  if (genres.length === 0) return 'Pick a few favorites — we’ll tune your library and recommendations.';
  if (genres.length === 1) return `${genres[0]} — nice. Add one more to keep going.`;
  if (genres.length === 2) return `You’re into ${genres[0]} & ${genres[1]}. We’ll find your pace.`;
  const rest = genres.length - 2;
  return `${genres[0]}, ${genres[1]} & ${rest} more — a reader with range.`;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, paddingTop: 8 },
  counter: { fontFamily: FONTS.uiMedium, fontSize: 13, textAlign: 'center' },
});
