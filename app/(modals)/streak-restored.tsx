import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS, INK, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { flameForDay, flameLayout } from '@/lib/streakCelebration';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
import { StreakRays } from '@/components/gamification/StreakRays';

// Streak restored — the payoff for spending one of the five.
//
// Reuses the tier flame rather than needing its own artwork: a restored 30-day streak
// IS the 30-day flame, and showing the real one is what makes the restore feel like
// getting the thing back rather than being handed a consolation badge.
//
// It ignites instead of unlocking. The flame snaps up fast (a relight, not a slow
// reveal) and the rays bloom behind it, but the copy stays honest: the streak is back
// and today is still unread, which is the single most useful thing this screen can say.
export default function StreakRestored() {
  const params = useLocalSearchParams<{ days?: string; restoresLeft?: string; countedToday?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const days = Math.max(1, parseInt(params.days ?? '1', 10) || 1);
  const restoresLeft = Math.max(0, parseInt(params.restoresLeft ?? '0', 10) || 0);
  const countedToday = params.countedToday === '1';
  const tier = flameForDay(days);

  const flameSize = Math.min(width * 0.52, 250);
  const raySize = Math.min(width * 1.15, 460);
  const art = flameLayout(tier, flameSize);

  const scale = useSharedValue(reduce ? 1 : 0.4);
  const bob = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduce) return;
    // Snappier than the unlock's 1.5s coin flip — a match catching, not a reveal.
    scale.value = withDelay(60, withSpring(1, { damping: 11, stiffness: 150, mass: 0.9 }));
    bob.value = withDelay(
      900,
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [reduce, scale, bob]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : Math.min(1, scale.value * 2.2),
    transform: [{ scale: scale.value * (1 + bob.value * 0.035) }],
  }));

  const close = () => router.back();
  const d = (ms: number) => (reduce ? 0 : ms);

  return (
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss" />

      <Confetti fire particleCount={reduce ? 0 : 90} colors={[tier.ray, tier.spark, '#FFF7EC']} />

      <View style={[styles.body, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.copy} pointerEvents="none">
          <Reveal d={d(420)} reduce={reduce}>
            <Text style={[styles.kicker, { color: tier.ray }]}>STREAK RESTORED</Text>
          </Reveal>
          <Reveal d={d(500)} reduce={reduce}>
            <Text style={styles.count} allowFontScaling={false}>{days}</Text>
          </Reveal>
          <Reveal d={d(560)} reduce={reduce}>
            <Text style={styles.unit}>DAY STREAK</Text>
          </Reveal>
          <Reveal d={d(640)} reduce={reduce}>
            <Text style={styles.blurb}>
              {countedToday
                ? 'Back where you left off, and today’s already counted. Keep it lit.'
                : 'Back where you left off. Read anything today and it keeps going.'}
            </Text>
          </Reveal>
        </View>

        <View style={styles.hero} pointerEvents="none">
          <StreakRays size={raySize} color={tier.ray} />
          <Animated.View style={flameStyle}>
            <View style={styles.flameBox}>
              <Image
                source={tier.source}
                style={{ width: art.width, height: art.height, marginLeft: art.dx, marginTop: art.dy }}
                contentFit="contain"
                transition={0}
                accessibilityIgnoresInvertColors
              />
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={reduce ? undefined : FadeIn.delay(860).duration(440)} style={styles.actions}>
          <PressBlock
            emphasis="primary"
            onPress={close}
            accessibilityLabel={countedToday ? 'Continue' : 'Start reading'}
            style={[styles.cta, { backgroundColor: tier.ray, borderColor: INK }]}
          >
            <Ionicons name={countedToday ? 'checkmark' : 'book'} size={19} color={INK} />
            <Text style={styles.ctaText}>{countedToday ? 'NICE' : 'READ TODAY'}</Text>
          </PressBlock>
          <Text style={styles.budget}>
            {restoresLeft} {restoresLeft === 1 ? 'restore' : 'restores'} left
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(460)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,9,5,0.90)' },
  body: { ...CENTER_COLUMN, flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 28 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  flameBox: { width: 250, height: 250, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  copy: { alignItems: 'center', gap: 2 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 3, textAlign: 'center' },
  count: {
    fontFamily: FONTS.monoBold, fontSize: 76, lineHeight: 82, color: '#FFF7EC',
    fontVariant: ['tabular-nums'], textAlign: 'center', ...NO_FONT_PAD,
  },
  unit: { fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 4, color: 'rgba(255,247,236,0.72)', textAlign: 'center' },
  blurb: {
    fontFamily: FONTS.serifMedium, fontSize: 18, lineHeight: 26, color: 'rgba(255,247,236,0.86)',
    textAlign: 'center', marginTop: 14, maxWidth: 330,
  },

  actions: { alignSelf: 'stretch', gap: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH_THICK,
  },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: INK, ...NO_FONT_PAD },
  budget: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,247,236,0.5)', textAlign: 'center' },
});
