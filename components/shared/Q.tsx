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
  | 'thinking';

// Static requires — Metro resolves image assets only from literal require() calls.
const SOURCES: Record<QExpression, number> = {
  waving: require('@/assets/q-expressions/q-waving.png'),
  happy: require('@/assets/q-expressions/q-happy.png'),
  confident: require('@/assets/q-expressions/q-confident.png'),
  levelup: require('@/assets/q-expressions/q-levelup.png'),
  surprised: require('@/assets/q-expressions/q-surprised.png'),
  reading: require('@/assets/q-expressions/q-reading.png'),
  'looking-up': require('@/assets/q-expressions/q-looking-up.png'),
  shrug: require('@/assets/q-expressions/q-shrug.png'),
  concerned: require('@/assets/q-expressions/q-concerned.png'),
  sleepy: require('@/assets/q-expressions/q-sleepy.png'),
  sleeping: require('@/assets/q-expressions/q-sleeping.png'),
  pointing: require('@/assets/q-expressions/q-pointing.png'),
  proud: require('@/assets/q-expressions/q-proud.png'),
  thinking: require('@/assets/q-expressions/q-thinking.png'),
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
