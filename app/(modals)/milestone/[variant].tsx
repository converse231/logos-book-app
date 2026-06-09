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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { Confetti } from '@/components/shared/Confetti';
import { CountUp } from '@/components/onboarding/CountUp';
import { PressBlock } from '@/components/shared/PressBlock';

type Variant = 'normal' | 'bigger' | 'cinematic' | 'legendary';

interface VariantConfig {
  kicker: string;
  tone: 'ember' | 'gold';
  icon: keyof typeof Ionicons.glyphMap;
  confetti: number;
  defaultCount: number;
}

const CONFIG: Record<Variant, VariantConfig> = {
  normal: { kicker: 'Milestone reached', tone: 'ember', icon: 'flame', confetti: 90, defaultCount: 7 },
  bigger: { kicker: 'Big milestone', tone: 'ember', icon: 'flame', confetti: 120, defaultCount: 30 },
  cinematic: { kicker: 'Incredible streak', tone: 'gold', icon: 'flame', confetti: 170, defaultCount: 100 },
  legendary: { kicker: 'Legendary', tone: 'gold', icon: 'trophy', confetti: 220, defaultCount: 365 },
};

// Escalating streak celebration (blueprint Section 5). Pushed on top of the
// session-complete celebration when complete_session returns a milestoneVariant;
// dismiss returns to the stats. A light neubrutalist takeover: paper field, a
// bordered flame block, a giant ink figure, and a reward-coloured CTA.
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

  // Readable accent for text/icons; bright fill for the CTA block (black ink on it).
  const accent = cfg.tone === 'gold' ? t.gold : t.ember;
  const fill = cfg.tone === 'gold' ? PALETTE.gold : PALETTE.ember;
  const tint = cfg.tone === 'gold' ? 'rgba(255,197,61,0.18)' : 'rgba(255,138,30,0.18)';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const close = () => router.back();

  return (
    <Pressable style={[styles.root, { backgroundColor: t.bg }]} onPress={close} accessibilityRole="button" accessibilityLabel="Continue">
      <Confetti fire particleCount={reduce ? 0 : cfg.confetti} />

      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        <MilestoneIcon icon={cfg.icon} accent={accent} tint={tint} border={t.border} reduce={reduce} />

        {/* kicker + number + label grouped so the kicker reads as a caption above the count */}
        <View style={styles.countBlock}>
          <Reveal d={reduce ? 0 : 220} reduce={reduce}>
            <Text style={[styles.kicker, { color: accent }]}>{cfg.kicker.toUpperCase()}</Text>
          </Reveal>

          <Reveal d={reduce ? 0 : 300} reduce={reduce}>
            <CountUp to={count} durationMs={1300} style={[styles.number, { color: t.text }]} />
          </Reveal>

          <Reveal d={reduce ? 0 : 380} reduce={reduce}>
            <Text style={[styles.label, { color: t.textSec }]}>DAY STREAK</Text>
          </Reveal>
        </View>

        <Reveal d={reduce ? 0 : 460} reduce={reduce}>
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

function MilestoneIcon({
  icon,
  accent,
  tint,
  border,
  reduce,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  tint: string;
  border: string;
  reduce: boolean;
}) {
  const scale = useSharedValue(reduce ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [reduce, scale]);
  return (
    <Animated.View style={[styles.glyph, { backgroundColor: tint, borderColor: border }, style]}>
      <Ionicons name={icon} size={50} color={accent} />
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
  glyph: {
    width: 96, height: 96, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32, ...SHADOW.card,
  },
  countBlock: { alignItems: 'center' },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  number: {
    fontFamily: FONTS.monoBold, fontSize: 104, height: 116, fontVariant: ['tabular-nums'],
    textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, minWidth: 160,
  },
  label: { fontFamily: FONTS.monoMedium, fontSize: 14, letterSpacing: 2, marginTop: 8 },
  blurb: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 28, maxWidth: 300 },
  footer: { paddingHorizontal: 24 },
  cta: { minHeight: 54, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: '#141414' },
});
