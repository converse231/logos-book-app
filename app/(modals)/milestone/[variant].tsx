import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { Confetti } from '@/components/shared/Confetti';
import { CountUp } from '@/components/onboarding/CountUp';
import { PressBlock } from '@/components/shared/PressBlock';

type Variant = 'normal' | 'bigger' | 'cinematic' | 'legendary';

interface VariantConfig {
  kicker: string;
  tone: 'ember' | 'gold';
  confetti: number;
  defaultCount: number;
}

const CONFIG: Record<Variant, VariantConfig> = {
  normal: { kicker: 'Milestone reached', tone: 'ember', confetti: 90, defaultCount: 7 },
  bigger: { kicker: 'Big milestone', tone: 'ember', confetti: 120, defaultCount: 30 },
  cinematic: { kicker: 'Incredible streak', tone: 'gold', confetti: 170, defaultCount: 100 },
  legendary: { kicker: 'Legendary', tone: 'gold', confetti: 220, defaultCount: 365 },
};

// Escalating streak celebration (blueprint Section 5). Pushed on top of the
// session-complete celebration when complete_session returns a milestoneVariant;
// dismiss returns to the stats. The streak lives INSIDE the fire — the day count
// springs up in the flame's belly and counts to its milestone — with a paper
// takeover, a reward-tone kicker, and a bright neubrutalist CTA.
export default function MilestoneCelebration() {
  const params = useLocalSearchParams<{ variant: string; count?: string }>();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const variant: Variant = (['normal', 'bigger', 'cinematic', 'legendary'] as const).includes(params.variant as Variant)
    ? (params.variant as Variant)
    : 'normal';
  const cfg = CONFIG[variant];
  const count = params.count ? parseInt(params.count, 10) || cfg.defaultCount : cfg.defaultCount;

  // Readable accent for text; bright fill for the CTA block (black ink on it).
  const accent = cfg.tone === 'gold' ? t.gold : t.ember;
  const fill = cfg.tone === 'gold' ? PALETTE.gold : PALETTE.ember;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const close = () => router.back();

  return (
    <Pressable style={[styles.root, { backgroundColor: t.bg }]} onPress={close} accessibilityRole="button" accessibilityLabel="Continue">
      <Confetti fire particleCount={reduce ? 0 : cfg.confetti} />

      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        <Reveal d={reduce ? 0 : 200} reduce={reduce}>
          <Text style={[styles.kicker, { color: accent }]}>{cfg.kicker.toUpperCase()}</Text>
        </Reveal>

        <FireStreak count={count} ember={t.ember} reduce={reduce} />

        <Reveal d={reduce ? 0 : 420} reduce={reduce}>
          <Text style={[styles.label, { color: t.textSec }]}>DAY STREAK</Text>
        </Reveal>

        <Reveal d={reduce ? 0 : 500} reduce={reduce}>
          <Text style={[styles.blurb, { color: t.textSec }]}>{blurbFor(count)}</Text>
        </Reveal>
      </View>

      <Animated.View
        entering={reduce ? undefined : FadeIn.delay(700)}
        style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}
      >
        <PressBlock
          onPress={close}
          accessibilityLabel="Keep it going"
          style={[styles.cta, { backgroundColor: fill, borderColor: t.border }]}
        >
          <Text style={styles.ctaText}>KEEP IT GOING</Text>
        </PressBlock>
      </Animated.View>
    </Pressable>
  );
}

function blurbFor(count: number): string {
  if (count >= 365) return 'A full year of showing up. You are in rare company.';
  if (count >= 100) return 'Triple digits. This is what devotion looks like.';
  if (count >= 30) return 'A month of daily reading. The habit is yours now.';
  return 'A full week, every day. The streak is real.';
}

// The flame is the hero and the streak count sits in its belly (Numo-style):
// the whole thing springs in, then the ink figure counts up to the milestone.
// Ink on the warm flame keeps the neubrutalist black-on-colour contrast, and the
// digit-aware size keeps even 365 inside the flame. Reduced motion → a static
// flame glyph with the final number.
function FireStreak({ count, ember, reduce }: { count: number; ember: string; reduce: boolean }) {
  const SIZE = 236;
  const numFont = count >= 100 ? 62 : count >= 10 ? 88 : 104;

  const scale = useSharedValue(reduce ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [reduce, scale]);

  return (
    <Animated.View
      style={[styles.fireWrap, { width: SIZE, height: SIZE }, style]}
      accessibilityRole="image"
      accessibilityLabel={`${count} day streak`}
    >
      {reduce ? (
        <Ionicons name="flame" size={SIZE} color={ember} />
      ) : (
        <Image
          source={require('@/assets/fire.webp')}
          style={{ width: SIZE, height: SIZE }}
          autoplay
          contentFit="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {/* Number nudged into the flame's belly (lower-centre of the silhouette). */}
      <View style={[styles.fireNumberSlot, { paddingTop: SIZE * 0.28 }]} pointerEvents="none">
        <CountUp
          to={count}
          durationMs={1300}
          style={[styles.fireNumber, { fontSize: numFont, lineHeight: numFont, color: INK }]}
        />
      </View>
    </Animated.View>
  );
}

function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(420)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0, paddingHorizontal: 32 },

  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, marginBottom: 12, textAlign: 'center' },

  fireWrap: { alignItems: 'center', justifyContent: 'center' },
  fireNumberSlot: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fireNumber: {
    fontFamily: FONTS.monoBold, fontVariant: ['tabular-nums'], textAlign: 'center',
    includeFontPadding: false, padding: 0, minWidth: 60,
  },

  label: { fontFamily: FONTS.monoMedium, fontSize: 14, letterSpacing: 2, marginTop: 12 },
  blurb: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 28, maxWidth: 300 },
  footer: { paddingHorizontal: 24 },
  cta: { minHeight: 54, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: '#141414' },
});
