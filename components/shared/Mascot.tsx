import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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

interface MascotProps {
  size?: number;
  /** Gentle idle bob. Reduced-motion always wins (renders static). */
  animated?: boolean;
  /** Scatter a few reward-coloured twinkle sparkles around Fable (empty states,
   *  celebrations). Off by default so the plain mascot stays clean. */
  sparkle?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// Fable — the LOGOS fox. Aesop's original storyteller, drawn in the Paper & Ink
// language: warm ember coat, cream muzzle, thick ink linework. A hand-built SVG
// (not an emoji) so it stays crisp at any size and owns the brand. Fixed identity
// colours read cleanly on both the light paper and the warm-dark substrate.
const INK = '#241E19';
const COAT = '#EF8A43';
const INNER = '#F7CFA4';
const MUZZLE = '#FBF6EC';

export function Mascot({
  size = 96,
  animated = true,
  sparkle = false,
  style,
  accessibilityLabel = 'Fable, the LOGOS fox',
}: MascotProps) {
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

  return (
    <Animated.View
      style={[aStyle, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* ears */}
        <Path d="M20 42 L27 12 L47 31 Z" fill={COAT} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <Path d="M80 42 L73 12 L53 31 Z" fill={COAT} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <Path d="M28 33 L31 19 L40 30 Z" fill={INNER} />
        <Path d="M72 33 L69 19 L60 30 Z" fill={INNER} />
        {/* head */}
        <Path
          d="M50 25 C75 25 83 44 83 59 C83 77 68 89 50 89 C32 89 17 77 17 59 C17 44 25 25 50 25 Z"
          fill={COAT}
          stroke={INK}
          strokeWidth={3.5}
        />
        {/* cream muzzle */}
        <Path
          d="M50 51 C65 51 73 60 73 69 C73 81 61 89 50 89 C39 89 27 81 27 69 C27 60 35 51 50 51 Z"
          fill={MUZZLE}
          stroke={INK}
          strokeWidth={3}
        />
        {/* eyes */}
        <Circle cx={38} cy={55} r={3.7} fill={INK} />
        <Circle cx={62} cy={55} r={3.7} fill={INK} />
        {/* nose + smile */}
        <Path d="M50 64 l6 5 h-12 Z" fill={INK} />
        <Path
          d="M50 69 v4.5 M50 73.5 q-6 4 -11 1 M50 73.5 q6 4 11 1"
          fill="none"
          stroke={INK}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>

      {sparkle ? (
        <>
          <Sparkle
            size={size * 0.24}
            color={PALETTE.gold}
            delay={0}
            style={{ position: 'absolute', top: -size * 0.04, right: -size * 0.02 }}
          />
          <Sparkle
            size={size * 0.17}
            color={PALETTE.level}
            delay={340}
            style={{ position: 'absolute', top: size * 0.14, left: -size * 0.1 }}
          />
          <Sparkle
            size={size * 0.15}
            color={PALETTE.ember}
            delay={660}
            style={{ position: 'absolute', bottom: size * 0.03, right: -size * 0.05 }}
          />
        </>
      ) : null}
    </Animated.View>
  );
}
