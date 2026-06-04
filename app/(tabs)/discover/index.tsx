import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';

const PREVIEW: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'sparkles', title: 'Picks for you', body: 'Recommendations tuned to the genres and authors you actually finish.' },
  { icon: 'layers', title: 'Swipe to shelf', body: 'Flick through a curated deck and send books straight to your TBR.' },
  { icon: 'people', title: 'What readers love', body: 'Surfacing the highest-rated reads from the Logos community.' },
];

// Discover (blueprint Section 3, Phase 2). The recommendation deck lands in a
// later phase; until then this previews what's coming rather than dead-ending.
export default function Discover() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const Reveal = ({ i, children }: { i: number; children: React.ReactNode }) =>
    reduce ? <View>{children}</View> : <Animated.View entering={FadeInUp.delay(i * 80).duration(440)}>{children}</Animated.View>;

  return (
    <ScreenBackground>
      <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.title, { color: t.text }]}>Discover</Text>

        <Reveal i={0}>
          <View style={styles.hero}>
            <View style={[styles.glyph, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
              <Ionicons name="compass" size={34} color={t.accent} />
            </View>
            <Text style={[styles.heroTitle, { color: t.text }]}>Your next favorite book is coming</Text>
            <Text style={[styles.heroBody, { color: t.textSec }]}>
              We are building a recommendation engine that learns from what you read, not what is trending.
            </Text>
          </View>
        </Reveal>

        <View style={styles.list}>
          {PREVIEW.map((p, i) => (
            <Reveal i={i + 1} key={p.title}>
              <Card padded style={styles.previewCard}>
                <View style={[styles.previewIcon, { backgroundColor: t.bgTer }]}>
                  <Ionicons name={p.icon} size={20} color={t.accent} />
                </View>
                <View style={styles.previewText}>
                  <Text style={[styles.previewTitle, { color: t.text }]}>{p.title}</Text>
                  <Text style={[styles.previewBody, { color: t.textSec }]}>{p.body}</Text>
                </View>
              </Card>
            </Reveal>
          ))}
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 18, gap: 18 },
  title: { fontFamily: FONTS.displayBold, fontSize: 32, lineHeight: 36 },
  hero: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  glyph: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: FONTS.displayBold, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  heroBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  list: { gap: 12 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1, gap: 3 },
  previewTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 16 },
  previewBody: { fontFamily: FONTS.uiRegular, fontSize: 13, lineHeight: 18 },
});
