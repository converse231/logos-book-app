import Svg, { Path } from 'react-native-svg';
import { StyleProp, ViewStyle } from 'react-native';
import { PALETTE } from '@/theme/tokens';

interface BookEmblemProps {
  size?: number;
  /** Stroke colour. Defaults to the brand coral. */
  color?: string;
  /** Stroke weight relative to the 120×92 viewBox. */
  weight?: number;
  style?: StyleProp<ViewStyle>;
}

// The open-book mark — a bold OUTLINE-only glyph (no fill, so whatever the card
// sits on shows through the pages). Used on share cards in place of a book cover,
// and anywhere a book needs representing without artwork. Drawn as SVG so it stays
// crisp at any capture size (share cards render at 1080w).
export function BookEmblem({
  size = 96,
  color = PALETTE.accent,
  weight = 5,
  style,
}: BookEmblemProps) {
  // viewBox is 120×92 — width-led, so height follows the glyph's aspect.
  const height = size * (92 / 120);

  return (
    <Svg width={size} height={height} viewBox="0 0 120 92" style={style}>
      {/* fanned page edges beneath (the "stack") */}
      <Path
        d="M10 62 C28 58 48 61 60 71 C72 61 92 58 110 62 L110 74 C92 70 72 73 60 83 C48 73 28 70 10 74 Z"
        fill="none"
        stroke={color}
        strokeWidth={weight}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* left page */}
      <Path
        d="M60 22 C48 12 28 9 10 13 L10 62 C28 58 48 61 60 71 Z"
        fill="none"
        stroke={color}
        strokeWidth={weight}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* right page */}
      <Path
        d="M60 22 C72 12 92 9 110 13 L110 62 C92 58 72 61 60 71 Z"
        fill="none"
        stroke={color}
        strokeWidth={weight}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* spine */}
      <Path d="M60 22 V71" stroke={color} strokeWidth={weight} strokeLinecap="round" />
    </Svg>
  );
}
