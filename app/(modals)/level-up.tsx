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
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { Confetti } from '@/components/shared/Confetti';
import { PressBlock } from '@/components/shared/PressBlock';
import { Q } from '@/components/shared/Q';

// Level-up celebration (blueprint Section 5). Pushed on top of session-complete
// when complete_session reports a crossed level boundary (result.leveledUp).
// Lilac is the level/celebration colour in the Paper & Ink system; Q holds the
// LEVEL UP scroll as the hero. Tap anywhere (or the CTA) to dismiss.
export default function LevelUp() {
  const params = useLocalSearchParams<{ level?: string; name?: string }>();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const level = params.level ? parseInt(params.level, 10) || 0 : 0;
  const name = params.name ?? 'New level';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const close = () => router.back();

  return (
    <Pressable style={[styles.root, { backgroundColor: t.bg }]} onPress={close} accessibilityRole="button" accessibilityLabel="Continue">
      <Confetti fire particleCount={reduce ? 0 : 160} />

      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        {level > 0 ? (
          <Reveal d={reduce ? 0 : 160} reduce={reduce}>
            <Text style={[styles.kicker, { color: t.level }]}>LEVEL {level}</Text>
          </Reveal>
        ) : null}

        <QHero reduce={reduce} />

        <Reveal d={reduce ? 0 : 440} reduce={reduce}>
          <Text style={[styles.name, { color: t.level }]}>{name}</Text>
        </Reveal>

        <Reveal d={reduce ? 0 : 520} reduce={reduce}>
          <Text style={[styles.blurb, { color: t.textSec }]}>
            A new title is yours. Keep logging pages to climb higher.
          </Text>
        </Reveal>
      </View>

      <Animated.View
        entering={reduce ? undefined : FadeIn.delay(700)}
        style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}
      >
        <PressBlock
          onPress={close}
          accessibilityLabel="Onward"
          style={[styles.cta, { backgroundColor: PALETTE.level, borderColor: t.border }]}
        >
          <Text style={styles.ctaText}>ONWARD</Text>
        </PressBlock>
      </Animated.View>
    </Pressable>
  );
}

// Q springs in on a well-damped spring, then keeps its own idle bob.
function QHero({ reduce }: { reduce: boolean }) {
  const scale = useSharedValue(reduce ? 1 : 0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!reduce) scale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [reduce, scale]);
  return (
    <Animated.View style={[styles.hero, style]}>
      <Q expression="levelup" size={216} sparkle />
    </Animated.View>
  );
}

function Reveal({ d, reduce, children }: { d: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(d).duration(420)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 3, marginBottom: 4, textAlign: 'center' },
  hero: { alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  name: { fontFamily: FONTS.serifBold, fontSize: 40, lineHeight: 44, textAlign: 'center', marginTop: 6 },
  blurb: { fontFamily: FONTS.serifMedium, fontSize: 18, lineHeight: 25, textAlign: 'center', marginTop: 18, maxWidth: 320 },
  footer: { paddingHorizontal: 24 },
  cta: { minHeight: 54, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: INK },
});
