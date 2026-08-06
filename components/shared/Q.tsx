import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { PALETTE } from '@/theme/tokens';
import { Sparkle } from './Sparkle';

// Q — the Quire fox (formerly "Fable"). A cast of hand-drawn expressions in the
// Paper & Ink palette, placed at the app's emotional beats the way Duolingo uses
// Duo: greeting on welcome, cheering a finished session, worried when a streak is
// at risk, curious in empty states. One component, one expression prop.
//
// Replaces the old hand-built SVG face (components/shared/Mascot.tsx) — the
// illustrated PNGs own the brand far better. Same gentle, reduced-motion-gated
// idle bob + optional reward-coloured sparkles.
export type QExpression =
  | 'waving'
  | 'happy'
  | 'confident'
  | 'levelup'
  | 'surprised'
  | 'reading'
  | 'looking-up'
  | 'shrug'
  | 'concerned'
  | 'sleepy'
  | 'sleeping'
  | 'pointing'
  | 'proud'
  | 'thinking'
  // Session-success ladder poses (lib/sessionCelebration). Full-body, each with
  // one prop, drawn to be read at ~250dp — unlike the older portrait crops above,
  // several of which are used as small as 42dp.
  | 'book-finished'
  | 'personal-best'
  | 'medal'
  | 'marathon'
  | 'celebrating'
  | 'headphones'
  | 'late-night'
  | 'thumbsup'
  | 'everyday'
  /** Guided-tour opt-in: Q holding an open map. */
  | 'tour';

// Static requires — Metro resolves image assets only from literal require() calls.
const SOURCES: Record<QExpression, number> = {
  waving: require('@/assets/q-expressions/q-waving.webp'),
  happy: require('@/assets/q-expressions/q-happy.webp'),
  confident: require('@/assets/q-expressions/q-confident.webp'),
  levelup: require('@/assets/q-expressions/q-levelup.webp'),
  surprised: require('@/assets/q-expressions/q-surprised.webp'),
  reading: require('@/assets/q-expressions/q-reading.webp'),
  'looking-up': require('@/assets/q-expressions/q-looking-up.webp'),
  shrug: require('@/assets/q-expressions/q-shrug.webp'),
  concerned: require('@/assets/q-expressions/q-concerned.webp'),
  sleepy: require('@/assets/q-expressions/q-sleepy.webp'),
  sleeping: require('@/assets/q-expressions/q-sleeping.webp'),
  pointing: require('@/assets/q-expressions/q-pointing.webp'),
  proud: require('@/assets/q-expressions/q-proud.webp'),
  thinking: require('@/assets/q-expressions/q-thinking.webp'),
  'book-finished': require('@/assets/q-expressions/q-book-finished.webp'),
  'personal-best': require('@/assets/q-expressions/q-personal-best.webp'),
  medal: require('@/assets/q-expressions/q-medal.webp'),
  marathon: require('@/assets/q-expressions/q-marathon.webp'),
  celebrating: require('@/assets/q-expressions/q-celebrating.webp'),
  headphones: require('@/assets/q-expressions/q-headphones.webp'),
  'late-night': require('@/assets/q-expressions/q-late-night.webp'),
  thumbsup: require('@/assets/q-expressions/q-thumbsup.webp'),
  everyday: require('@/assets/q-expressions/q-everyday.webp'),
  tour: require('@/assets/q-expressions/q-tour.webp'),
};

const LABELS: Record<QExpression, string> = {
  waving: 'Q the fox, waving hello',
  happy: 'Q the fox, celebrating',
  confident: 'Q the fox, looking confident',
  levelup: 'Q the fox holding a level-up banner',
  surprised: 'Q the fox, surprised',
  reading: 'Q the fox, reading a book',
  'looking-up': 'Q the fox, holding a book',
  shrug: 'Q the fox, shrugging',
  concerned: 'Q the fox, looking concerned',
  sleepy: 'Q the fox, getting sleepy',
  sleeping: 'Q the fox, asleep',
  pointing: 'Q the fox, pointing ahead',
  proud: 'Q the fox, giving a thumbs-up',
  thinking: 'Q the fox, thinking',
  'book-finished': 'Q the fox, hugging a finished book',
  'personal-best': 'Q the fox, leaping with a stopwatch',
  medal: 'Q the fox, holding up a medal',
  marathon: 'Q the fox, resting beside a stack of books',
  celebrating: 'Q the fox, celebrating with a book',
  headphones: 'Q the fox, listening with headphones',
  'late-night': 'Q the fox, reading late by candlelight',
  thumbsup: 'Q the fox, giving a thumbs-up',
  everyday: 'Q the fox, closing a book',
  tour: 'Q the fox, holding an open map',
};

interface QProps {
  expression: QExpression;
  /** Square bounding box (px). The character is portrait, centred with `contain`. */
  size?: number;
  /** Gentle idle bob. Reduced-motion always wins (renders static). */
  animated?: boolean;
  /** Scatter a few reward-coloured twinkle sparkles around Q. */
  sparkle?: boolean;
  /** Hide from screen readers when adjacent text already conveys the meaning. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Q({
  expression,
  size = 120,
  animated = true,
  sparkle = false,
  decorative = false,
  style,
  accessibilityLabel,
}: QProps) {
  const reduce = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!animated || reduce) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [animated, reduce, bob]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 4 }] }));

  const a11y = decorative
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
    : { accessibilityRole: 'image' as const, accessibilityLabel: accessibilityLabel ?? LABELS[expression] };

  return (
    <Animated.View style={[aStyle, style]} {...a11y}>
      <Image
        source={SOURCES[expression]}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={0}
      />

      {sparkle ? (
        <>
          <Sparkle
            size={size * 0.22}
            color={PALETTE.gold}
            delay={0}
            style={{ position: 'absolute', top: -size * 0.02, right: -size * 0.04 }}
          />
          <Sparkle
            size={size * 0.15}
            color={PALETTE.level}
            delay={340}
            style={{ position: 'absolute', top: size * 0.16, left: -size * 0.08 }}
          />
          <Sparkle
            size={size * 0.14}
            color={PALETTE.ember}
            delay={660}
            style={{ position: 'absolute', bottom: size * 0.04, right: -size * 0.02 }}
          />
        </>
      ) : null}
    </Animated.View>
  );
}
