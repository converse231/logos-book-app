import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ProgressDots } from './ProgressDots';

interface OnboardingScaffoldProps {
  step: number; // 0-indexed
  totalSteps: number;
  title: string;
  subtitle?: string;
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
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 16);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [opacity, translateY]);

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
      {/* Top bar */}
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable
            onPress={onBack}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  titleUi: { fontFamily: FONTS.uiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  titleDisplay: { fontFamily: FONTS.displayBold, fontSize: 40, lineHeight: 44 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 16, lineHeight: 23 },
  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 12 },
});
