import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { GenreChip } from '@/components/onboarding/GenreChip';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi', 'Romance', 'Thriller',
  'Mystery', 'Literary Fiction', 'Historical', 'Horror', 'Spirituality',
  'Psychology', 'Self-Help', 'Biography', 'Philosophy', 'Poetry',
  'Business', 'Science', 'Young Adult', 'Classics',
];

const MIN_GENRES = 2;

// RULE 2: mirror the user's picks back in the subtitle so the selection feels
// seen ("You're into Fantasy & Sci-Fi…"). Requires ≥2 genres before continuing.
export default function Genres() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const { genres, toggleGenre } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const subtitle = useMemo(() => mirrorBack(genres), [genres]);
  const canContinue = genres.length >= MIN_GENRES;

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      await api.setGenrePrefs(genres);
      router.push('/(onboarding)/goal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={5}
      title="What do you love to read?"
      subtitle={subtitle}
      onBack={() => router.back()}
      scroll
      footer={
        <>
          <Text style={[styles.counter, { color: canContinue ? t.accent : t.textSec }]}>
            {genres.length} selected{!canContinue ? ` · pick ${MIN_GENRES - genres.length} more` : ''}
          </Text>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            loading={submitting}
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
