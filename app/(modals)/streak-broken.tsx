import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS, INK, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD, LIGHT_TOKENS } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { BROKEN_FLAME, flameLayout } from '@/lib/streakCelebration';
import { PressBlock } from '@/components/shared/PressBlock';
import { Reveal } from '@/components/shared/Reveal';
import { useApi } from '@/services/ApiContext';

// Streak broken — the mirror of streak-unlocked, and deliberately its opposite in
// every motion decision.
//
// The celebration spins a coin, throws confetti and rotates a sunburst. This one has
// none of that: no rays, no confetti, no glow. The flame fades in already grey and
// SINKS a few pixels as it settles. The absence of the burst is the message; adding a
// consolation animation would undercut it.
//
// It is not a scolding screen though. The whole reason it exists is the button, so
// the copy stays short and the restore is the loudest thing on it.
export default function StreakBroken() {
  const params = useLocalSearchParams<{ days?: string; restoresLeft?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const api = useApi();

  const days = Math.max(0, parseInt(params.days ?? '0', 10) || 0);
  const restoresLeft = Math.max(0, parseInt(params.restoresLeft ?? '0', 10) || 0);
  const canRestore = restoresLeft > 0;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flameSize = Math.min(width * 0.52, 250);
  const art = flameLayout(BROKEN_FLAME, flameSize);

  // Settle, don't arrive: fades up from slightly large and drifts DOWN into place,
  // the read of something going out rather than lighting up.
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (reduce) return;
    p.value = withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [reduce, p]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 1.08 - p.value * 0.08 }, { translateY: (1 - p.value) * -14 }],
  }));

  const close = () => router.back();

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.restoreStreak();
      if (!res.ok) {
        // The server re-checks every rule, so it can refuse something the overlay
        // believed was on offer — a second device, or the window closing mid-view.
        setError(REASONS[res.reason ?? ''] ?? 'That didn’t work. Try again in a moment.');
        setBusy(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: '/(modals)/streak-restored',
        params: {
          days: String(res.currentStreak ?? days),
          restoresLeft: String(res.restoresLeft ?? Math.max(0, restoresLeft - 1)),
          countedToday: res.countedToday ? '1' : '0',
        },
      } as unknown as Href);
    } catch {
      setError('No connection. Your streak is still restorable — try again.');
      setBusy(false);
    }
  };

  const d = (ms: number) => (reduce ? 0 : ms);

  return (
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss" />

      <View style={[styles.body, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.copy} pointerEvents="none">
          <Reveal delay={d(520)}>
            <Text style={styles.kicker}>STREAK ENDED</Text>
          </Reveal>
          <Reveal delay={d(600)}>
            <Text style={styles.count} allowFontScaling={false}>{days}</Text>
          </Reveal>
          <Reveal delay={d(660)}>
            <Text style={styles.unit}>{days === 1 ? 'DAY LOST' : 'DAYS LOST'}</Text>
          </Reveal>
          <Reveal delay={d(740)}>
            <Text style={styles.blurb}>
              {canRestore
                ? 'You missed a day. Use a restore to pick it back up exactly where you left off.'
                : 'You missed a day, and you’re out of restores. The only way back is a new streak — starting today.'}
            </Text>
          </Reveal>
        </View>

        <View style={styles.hero} pointerEvents="none">
          <Animated.View style={flameStyle}>
            <View style={styles.flameBox}>
              <Image
                source={BROKEN_FLAME.source}
                style={{ width: art.width, height: art.height, transform: [{ translateX: art.dx }, { translateY: art.dy }] }}
                contentFit="contain"
                transition={0}
                accessibilityIgnoresInvertColors
              />
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={reduce ? undefined : FadeIn.delay(900).duration(440)} style={styles.actions}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {canRestore ? (
            <>
              <PressBlock
            emphasis="primary"
                onPress={restore}
                disabled={busy}
                accessibilityLabel={`Restore your ${days} day streak. ${restoresLeft} restores left.`}
                style={[styles.cta, { backgroundColor: LIGHT_TOKENS.accent, borderColor: INK }, busy && { opacity: 0.6 }]}
              >
                <Ionicons name="flame" size={19} color={INK} />
                <Text style={styles.ctaText}>{busy ? 'RESTORING…' : 'RESTORE STREAK'}</Text>
              </PressBlock>
              <Text style={styles.budget}>
                {restoresLeft} {restoresLeft === 1 ? 'restore' : 'restores'} left · they never refill
              </Text>
            </>
          ) : null}

          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={canRestore ? 'Not now' : 'Continue'}
            style={({ pressed }) => [styles.continue, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.continueText}>{canRestore ? 'NOT NOW' : 'CONTINUE'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// Named reasons from restore_streak, turned into something a reader can act on.
const REASONS: Record<string, string> = {
  no_restores: 'You’re out of restores.',
  window_closed: 'This streak can no longer be restored — the 48-hour window has closed.',
  streak_too_short: 'That streak was too short to restore.',
  nothing_to_restore: 'This streak has already been restored.',
  no_streak: 'Nothing to restore yet.',
};


const styles = StyleSheet.create({
  root: { flex: 1 },
  // Colder and heavier than the celebration's warm near-black — there's no fire
  // here for a warm scrim to agree with.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,9,11,0.92)' },
  body: { ...CENTER_COLUMN, flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 28 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  flameBox: { width: 250, height: 250, maxWidth: '100%', alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 2 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 3, color: BROKEN_FLAME.ray, textAlign: 'center' },
  count: {
    fontFamily: FONTS.monoBold, fontSize: 76, lineHeight: 82, color: 'rgba(240,238,235,0.82)',
    fontVariant: ['tabular-nums'], textAlign: 'center', ...NO_FONT_PAD,
  },
  unit: { fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 4, color: 'rgba(240,238,235,0.5)', textAlign: 'center' },
  blurb: {
    fontFamily: FONTS.serifMedium, fontSize: 18, lineHeight: 26, color: 'rgba(240,238,235,0.78)',
    textAlign: 'center', marginTop: 14, maxWidth: 330,
  },

  actions: { alignSelf: 'stretch', gap: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54,
    borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH_THICK,
  },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: INK, ...NO_FONT_PAD },
  budget: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, color: 'rgba(240,238,235,0.45)', textAlign: 'center' },
  error: {
    fontFamily: FONTS.uiRegular, fontSize: 13, lineHeight: 18, color: '#F0A08C',
    textAlign: 'center', paddingHorizontal: 8,
  },
  continue: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, color: 'rgba(240,238,235,0.55)' },
});
