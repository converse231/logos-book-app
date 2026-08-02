import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
// expo-image, not RN Image: the flames ship as WebP (95% smaller) and RN's iOS
// Image cannot decode WebP.
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS, INK, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { flameForDay, flameLayout } from '@/lib/streakCelebration';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
import { StreakRays } from '@/components/gamification/StreakRays';

// Streak unlocked — the moment a reader lands back on Home having just hit a streak
// tier (1, 7, 14, 30, 50, 67, 100, 150, 200, 250, 365).
//
// Deliberately the ONE dark surface in a light-first app: these flames are luminous
// objects with their glow baked into the artwork, and on oat paper they'd look like
// stickers. Dimming Home to near-black turns the screen into a lightbox and lets the
// burst actually read as light.
//
// The whole composition takes its colour from the flame — rays, bloom, kicker,
// confetti, CTA — so day 100 arrives blue and day 250 violet without a second set of
// design decisions.
export default function StreakUnlocked() {
  const params = useLocalSearchParams<{ day?: string; pages?: string; books?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const day = Math.max(1, parseInt(params.day ?? '1', 10) || 1);
  const tier = flameForDay(day);

  // Flame sized off the screen, rays a little wider so the burst reaches past it.
  const flameSize = Math.min(width * 0.52, 250);
  const raySize = Math.min(width * 1.15, 460);
  const art = flameLayout(tier, flameSize);

  // ── entrance ──────────────────────────────────────────────────────────────
  // A coin flip, not a pop: the flame turns THREE times around its vertical axis
  // over a decelerating 1.5s while it grows, then settles with one soft overshoot.
  // (Two turns in 0.76s read as a flicker — you couldn't see it was a coin.)
  // Perspective is what keeps it a solid object turning rather than a squashed texture.
  const scale = useSharedValue(reduce ? 1 : 0.15);
  const spin = useSharedValue(reduce ? 1 : 0);
  const bob = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduce) return;
    scale.value = withDelay(90, withSpring(1, { damping: 14, stiffness: 62, mass: 1.15 }));
    spin.value = withDelay(90, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }));
    // ...then it never fully rests: a slow breath keeps the flame alive under the
    // rotating rays instead of sitting there like a screenshot.
    bob.value = withDelay(
      1650,
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [reduce, scale, spin, bob]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : Math.min(1, scale.value * 2.2),
    transform: [
      { perspective: 900 },
      { rotateY: `${spin.value * 1080}deg` },
      { scale: scale.value * (1 + bob.value * 0.035) },
    ],
  }));

  const close = () => router.back();

  const share = () => {
    Haptics.selectionAsync();
    router.replace({
      pathname: '/(modals)/share-card',
      params: {
        streak: String(day),
        pagesTotal: params.pages ?? '',
        booksTotal: params.books ?? '',
      },
    } as unknown as Href);
  };

  const d = (ms: number) => (reduce ? 0 : ms);

  return (
    <View style={styles.root}>
      {/* Home stays faintly visible behind — you came back to it, and the flame is
          lighting the room rather than replacing it. */}
      <Pressable
        style={styles.scrim}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      <Confetti fire particleCount={reduce ? 0 : 110} colors={[tier.ray, tier.spark, '#FFF7EC']} />

      <View style={[styles.body, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        {/* Copy leads, flame is the centrepiece, actions close it out. Stacked under
            the flame the text was crowded against the buttons — and the reference
            we're chasing reads top-down too. */}
        <View style={styles.copy} pointerEvents="none">
          <Reveal d={d(760)} reduce={reduce}>
            <Text style={[styles.kicker, { color: tier.ray }]}>STREAK UNLOCKED</Text>
          </Reveal>
          <Reveal d={d(860)} reduce={reduce}>
            <Text style={styles.count} allowFontScaling={false}>{day}</Text>
          </Reveal>
          <Reveal d={d(920)} reduce={reduce}>
            <Text style={styles.unit}>{day === 1 ? 'DAY' : 'DAY STREAK'}</Text>
          </Reveal>
          <Reveal d={d(1010)} reduce={reduce}>
            <Text style={styles.blurb}>{blurbFor(day)}</Text>
          </Reveal>
        </View>

        <View style={styles.hero} pointerEvents="none">
          <StreakRays size={raySize} color={tier.ray} />
          <Animated.View style={flameStyle}>
            <View style={{ width: flameSize, height: flameSize, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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

        <Animated.View
          entering={reduce ? undefined : FadeIn.delay(1220).duration(440)}
          style={styles.actions}
        >
          <PressBlock
            onPress={share}
            accessibilityLabel="Share this streak"
            style={[styles.cta, { backgroundColor: tier.ray, borderColor: INK }]}
          >
            <Ionicons name="share-social" size={19} color={INK} />
            <Text style={styles.ctaText}>SHARE THIS</Text>
          </PressBlock>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={({ pressed }) => [styles.continue, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.continueText}>CONTINUE</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(460)}>{children}</Animated.View>;
}

// Each tier gets its own line. Generic praise on day 250 would undo the whole point
// of having drawn a different flame for it.
function blurbFor(day: number): string {
  switch (day) {
    case 1:   return 'It starts with one. Come back tomorrow and it becomes a streak.';
    case 7:   return 'A full week of reading. This is the part most people never reach.';
    case 14:  return 'Two weeks. It’s stopped being a decision and started being a habit.';
    case 30:  return 'A month straight. Whatever else happened, you read.';
    case 50:  return 'Fifty days. Your flame has changed colour — and so has your year.';
    case 67:  return 'Sixty-seven days. Long past the point where habits are supposed to stick.';
    case 100: return 'One hundred days. The fire burns blue now. Very few readers see this.';
    case 150: return 'A hundred and fifty. You’ve read on the good days and the bad ones.';
    case 200: return 'Two hundred days of pages. This is a body of work.';
    case 250: return 'Two hundred and fifty. You’re closing in on the whole year.';
    case 365: return 'A year. Every single day. There is nothing left to prove.';
    default:  return `${day} days in a row. Keep the flame lit.`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Deep warm near-black — cold grey would fight the flames' amber glow.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,9,5,0.90)' },
  body: { ...CENTER_COLUMN, flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 28 },

  // The flame absorbs the slack between the copy and the actions, so it stays
  // optically centred whatever length the blurb runs to.
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
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

  // In flow, not absolute: copy / flame / actions is now a clean three-band stack,
  // and the flame's flex:1 already reserves the space between them.
  actions: { alignSelf: 'stretch', gap: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH_THICK,
  },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: INK, ...NO_FONT_PAD },
  continue: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, color: 'rgba(255,247,236,0.6)' },
});
