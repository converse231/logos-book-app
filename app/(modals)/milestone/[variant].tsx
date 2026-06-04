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
import { FONTS, PALETTE } from '@/theme/tokens';
import { Confetti } from '@/components/shared/Confetti';
import { CountUp } from '@/components/onboarding/CountUp';

type Variant = 'normal' | 'bigger' | 'cinematic' | 'legendary';

interface VariantConfig {
  kicker: string;
  tone: 'emerald' | 'gold';
  icon: keyof typeof Ionicons.glyphMap;
  confetti: number;
  defaultCount: number;
}

const CONFIG: Record<Variant, VariantConfig> = {
  normal: { kicker: 'Milestone reached', tone: 'emerald', icon: 'flame', confetti: 90, defaultCount: 7 },
  bigger: { kicker: 'Big milestone', tone: 'emerald', icon: 'flame', confetti: 120, defaultCount: 30 },
  cinematic: { kicker: 'Incredible streak', tone: 'gold', icon: 'flame', confetti: 170, defaultCount: 100 },
  legendary: { kicker: 'Legendary', tone: 'gold', icon: 'trophy', confetti: 220, defaultCount: 365 },
};

// Escalating streak celebration (blueprint Section 5). Pushed on top of the
// session-complete celebration when complete_session returns a milestoneVariant;
// dismiss returns to the stats. Reduced-motion gated.
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
  const color = cfg.tone === 'gold' ? t.gold : t.accent;
  const tint = cfg.tone === 'gold' ? 'rgba(255,197,61,0.16)' : 'rgba(61,123,255,0.16)';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const close = () => router.back();

  return (
    <Pressable style={styles.root} onPress={close} accessibilityRole="button" accessibilityLabel="Continue">
      <Confetti fire particleCount={reduce ? 0 : cfg.confetti} />

      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        <MilestoneIcon icon={cfg.icon} color={color} tint={tint} reduce={reduce} />

        <Reveal d={reduce ? 0 : 220} reduce={reduce}>
          <Text style={[styles.kicker, { color }]}>{cfg.kicker.toUpperCase()}</Text>
        </Reveal>

        <Reveal d={reduce ? 0 : 300} reduce={reduce}>
          <View style={styles.numberRow}>
            <View style={[styles.numberGlow, { backgroundColor: tint }]} pointerEvents="none" />
            <CountUp to={count} durationMs={1300} style={[styles.number, { color: t.text }]} />
          </View>
        </Reveal>

        <Reveal d={reduce ? 0 : 380} reduce={reduce}>
          <Text style={[styles.label, { color: t.textSec }]}>day streak</Text>
        </Reveal>

        <Reveal d={reduce ? 0 : 460} reduce={reduce}>
          <Text style={[styles.blurb, { color: t.textSec }]}>{blurbFor(count)}</Text>
        </Reveal>
      </View>

      <Animated.View
        entering={reduce ? undefined : FadeIn.delay(700)}
        style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable onPress={close} style={[styles.cta, { backgroundColor: color }]} accessibilityRole="button" accessibilityLabel="Keep it going">
          <Text style={[styles.ctaText, { color: PALETTE.onAccent }]}>Keep it going</Text>
        </Pressable>
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
  color,
  tint,
  reduce,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
  reduce: boolean;
}) {
  const scale = useSharedValue(reduce ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [reduce, scale]);
  return (
    <Animated.View style={[styles.glyph, { backgroundColor: tint }, style]}>
      <Ionicons name={icon} size={50} color={color} />
    </Animated.View>
  );
}

function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(420)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0B0E' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  glyph: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kicker: { fontFamily: FONTS.uiBold, fontSize: 13, letterSpacing: 1.6 },
  numberRow: { alignItems: 'center', justifyContent: 'center' },
  numberGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 200, opacity: 0.7 },
  number: { fontFamily: FONTS.uiBold, fontSize: 104, lineHeight: 112, fontVariant: ['tabular-nums'], textAlign: 'center', minWidth: 160 },
  label: { fontFamily: FONTS.uiMedium, fontSize: 18, marginTop: -6 },
  blurb: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12, maxWidth: 300 },
  footer: { paddingHorizontal: 24 },
  cta: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 16 },
});
