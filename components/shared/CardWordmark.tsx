import { Image, StyleProp, ImageStyle } from 'react-native';
import { CardTextColor } from '@/services/cardColors';

// Static requires — Metro resolves image assets only from literal require() calls.
const SOURCES: Record<CardTextColor, number> = {
  white: require('@/assets/quire-text-logo-white.png'),
  black: require('@/assets/quire-text-logo-black.png'),
  vermilion: require('@/assets/quire-text-logo-vermillion.png'),
};

/** Artwork is 3000 × 916, so height follows width at this ratio. */
const ASPECT = 916 / 3000;

/** Share of the card's width. Large enough to survive a story being scaled down,
 *  small enough to stay a signature rather than a sixth statistic. */
const WIDTH_RATIO = 0.16;

// The Quire wordmark as it appears on an exported share card: a signature in the
// corner, sized and placed off the card width like everything else on the canvas so
// it holds at both the 1080 capture and the on-screen preview.
//
// Colour follows the card's ink so the mark and the type are never two different
// colours by accident. Nudged to 0.92 opacity, which steps it just behind the stats
// in the reading order without looking faded.
//
// `fadeDuration={0}` matters: react-native-view-shot can fire mid-fade and capture a
// half-transparent mark (BookProgressMark does the same for the same reason).
export function CardWordmark({
  cardWidth,
  color,
  style,
}: {
  cardWidth: number;
  color: CardTextColor;
  style?: StyleProp<ImageStyle>;
}) {
  const width = cardWidth * WIDTH_RATIO;
  return (
    <Image
      source={SOURCES[color] ?? SOURCES.white}
      style={[{ width, height: width * ASPECT, opacity: 0.92 }, style]}
      resizeMode="contain"
      fadeDuration={0}
      accessibilityIgnoresInvertColors
    />
  );
}
