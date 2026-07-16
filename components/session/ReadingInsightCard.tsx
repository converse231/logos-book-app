import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { InsightType } from '@/services/types';

interface ReadingInsightCardProps {
  insight: { id: string; type: InsightType; text: string };
  onShare: (id: string) => void;
  onSave: (id: string) => void;
  onAutoDismiss: () => void;
}

const CARD_H = 200;
const AUTO_MS = 6000;

// Each insight type owns a distinct hue, harmonised to the Paper & Ink palette
// (warm, cozy, still legible as an accent border + text on the card).
const TYPE_COLOR: Record<InsightType, string> = {
  TIME_OF_DAY: '#F2913F',    // amber
  PACE_TREND: '#F0764F',     // coral
  GENRE_SPEED: '#D99A2B',    // marigold
  CONSISTENCY: '#6E9A5E',    // sage
  PAGE_MILESTONE: '#9A7BD6', // lilac
  BEST_SESSION: '#D9730F',   // deep amber
  BOOK_PACE: '#4E9E93',      // dusty teal
};

// Variable-reward reveal (blueprint 4A/6). Slides up from the bottom over the
// celebration, lingers 6s, then auto-dismisses. Swipe up = save, swipe down =
// dismiss early, tap Share = open composer. Accent border keyed to insight type.
export function ReadingInsightCard({ insight, onShare, onSave, onAutoDismiss }: ReadingInsightCardProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const accent = TYPE_COLOR[insight.type] ?? t.accent;

  const translateY = useSharedValue(reduceMotion ? 0 : CARD_H + 40);
  const dismissed = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = (saved: boolean) => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (saved) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSave(insight.id);
    }
    translateY.value = withTiming(CARD_H + 60, { duration: 280 }, () => {
      runOnJS(onAutoDismiss)();
    });
  };

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
    autoTimer.current = setTimeout(() => dismiss(false), AUTO_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < 0) translateY.value = e.translationY * 0.5; // resist upward
      else translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY < -50) {
        runOnJS(dismiss)(true); // swipe up → save
      } else if (e.translationY > 60) {
        runOnJS(dismiss)(false); // swipe down → dismiss
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 160 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          cardStyle,
          { backgroundColor: t.bgSec, borderColor: accent },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Reading insight: ${insight.text}. Double-tap to share.`}
      >
        <View style={styles.grabber}>
          <View style={[styles.grabberBar, { backgroundColor: t.border }]} />
        </View>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={16} color={accent} />
          <Text style={[styles.headerText, { color: accent }]}>READING INSIGHT</Text>
        </View>
        <Text style={[styles.body, { color: t.text }]}>{insight.text}</Text>
        <View style={styles.actions}>
          <Text style={[styles.hint, { color: t.textTer }]}>SWIPE UP TO SAVE</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onShare(insight.id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Share this insight"
            style={[styles.shareBtn, { backgroundColor: accent, borderColor: t.border }]}
          >
            <Ionicons name="share-outline" size={16} color="#FFFFFF" />
            <Text style={styles.shareText}>SHARE</Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    minHeight: CARD_H,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH_THICK,
    padding: 18,
    gap: 10,
    ...SHADOW.card,
  },
  grabber: { alignItems: 'center', marginTop: -6, marginBottom: 2 },
  grabberBar: { width: 40, height: 4, borderRadius: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.2 },
  body: { fontFamily: FONTS.displaySemiBold, fontSize: 22, lineHeight: 28, flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, minHeight: 40, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK,
  },
  shareText: { fontFamily: FONTS.uiBold, fontSize: 14, color: '#FFFFFF', letterSpacing: 0.5 },
});
