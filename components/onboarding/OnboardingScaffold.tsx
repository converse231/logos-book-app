import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { CENTER_COLUMN_FILL } from '@/theme/layout';
import { ONBOARDING_STEPS } from '@/stores/onboardingStore';
import { ProgressDots } from './ProgressDots';

interface OnboardingScaffoldProps {
  step: number; // 0-indexed, indexes ONBOARDING_STEPS
  totalSteps: number;
  title: string;
  subtitle?: string;
  /** Defaults to "pop, or fall back to the previous step". Only pass this to
   *  override; step 0 gets no back button either way. */
  onBack?: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode;
  titleFont?: 'display' | 'ui';
  scroll?: boolean;
}

// Shared one-question-per-screen layout: safe-area top bar (back + progress),
// animated heading block, content, and a footer pinned above the safe-area
// bottom. Content fades/slides in on mount (ease-out, ≤300ms, reduced-motion
// aware). Used by every onboarding screen for visual consistency.
export function OnboardingScaffold({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  children,
  footer,
  titleFont = 'ui',
  scroll = false,
}: OnboardingScaffoldProps) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // The boot redirect can drop a reader straight onto a mid-funnel step to
  // resume, which leaves nothing to pop — so back has to know the step order,
  // not just the navigation history.
  const handleBack =
    onBack ??
    (step > 0
      ? () => {
          if (router.canGoBack()) router.back();
          else router.replace(ONBOARDING_STEPS[step - 1] as Href);
        }
      : undefined);

  // Only the FIRST screen brings its own entrance. Every other step arrives on a
  // card push, and running a 280ms fade-and-rise of the content at the same time
  // as the card slides in was two competing motions — the single biggest reason
  // the funnel felt mushy rather than deliberate. Step 0 has no push behind it
  // (it's the stack's initial route, reached from the splash), so it still needs
  // one of its own.
  const animateIn = step === 0 && !reduceMotion;
  const opacity = useSharedValue(animateIn ? 0 : 1);
  const translateY = useSharedValue(animateIn ? 16 : 0);

  useEffect(() => {
    if (!animateIn) return;
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [animateIn, opacity, translateY]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const heading = (
    <View style={styles.heading}>
      <Text
        style={[
          titleFont === 'display' ? styles.titleDisplay : styles.titleUi,
          { color: t.text },
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: t.textSec }]}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* Everything is clamped to the centred reading column so a tablet gets the
          designed one-question-per-screen layout, not a 780dp-wide CTA. */}
      <View style={styles.column}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {handleBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={t.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <ProgressDots total={totalSteps} current={step} />
        <View style={styles.backBtn} />
      </View>

      <Animated.View style={[styles.flex, contentStyle]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {heading}
            {children}
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            {heading}
            {children}
          </View>
        )}
      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>{footer}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: CENTER_COLUMN_FILL,
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 24 },
  heading: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 10 },
  titleUi: { fontFamily: FONTS.uiBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, textTransform: 'uppercase' },
  // 44/46 pushed the welcome hero to three tall lines and squeezed everything
  // below it off a small phone; 38/42 still reads as the display moment.
  titleDisplay: { fontFamily: FONTS.serifBold, fontSize: 38, lineHeight: 42, letterSpacing: 0 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 16, lineHeight: 23 },
  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 12 },
});
