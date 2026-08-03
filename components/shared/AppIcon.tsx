import type { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Hand-drawn replacements, keyed by the Ionicons name they stand in for.
 *
 * Keying on the Ionicons name is what makes this migration incremental: a call site
 * doesn't change when art arrives, and the 90-odd glyphs with no custom art keep
 * rendering from the font exactly as before. Add a pair here and it takes over.
 *
 * Metro resolves image assets only from literal require() calls.
 */
const CUSTOM: Partial<Record<string, { active: number; inactive: number }>> = {
  home: {
    active: require('@/assets/tab-bar-icons/home-icon.png'),
    inactive: require('@/assets/tab-bar-icons/home-icon-inactive.png'),
  },
  library: {
    active: require('@/assets/tab-bar-icons/library-icon.png'),
    inactive: require('@/assets/tab-bar-icons/library-icon-inactive.png'),
  },
  compass: {
    active: require('@/assets/tab-bar-icons/discover-icon.png'),
    inactive: require('@/assets/tab-bar-icons/discover-icon-inactive.png'),
  },
  'ellipsis-horizontal-circle': {
    active: require('@/assets/tab-bar-icons/more-icon.png'),
    inactive: require('@/assets/tab-bar-icons/more-icon-inactive.png'),
  },
};

/** The art is fitted to 90% of its canvas so nothing clips, so drawing it at the
 *  nominal size would make it read ~10% smaller than an Ionicon beside it. */
const ART_SCALE = 1 / 0.9;

interface AppIconProps {
  /** An Ionicons name. With `focused`, pass the FILLED name — the outline variant
   *  is derived, matching how the tab bar has always worked. */
  name: IoniconName;
  /** Omit entirely for a plain icon; pass it for a two-state (tab) icon. */
  focused?: boolean;
  size?: number;
  /** Tints font glyphs. Ignored by custom art, which carries its own colour. */
  color?: string;
  style?: StyleProp<ImageStyle>;
}

/**
 * One icon, from hand-drawn art when we have it and from Ionicons when we don't.
 *
 * Two states matter here. Custom art ships as a PAIR of images — a painted icon
 * can't be tinted the way a font glyph can, so "active" and "inactive" are separate
 * files rather than one shape in two colours. That also means `color` has no effect
 * on custom icons; the palette lives in the artwork.
 */
export function AppIcon({ name, focused, size = 24, color, style }: AppIconProps) {
  const art = focused === undefined ? undefined : CUSTOM[name];

  if (art) {
    const s = Math.round(size * ART_SCALE);
    return (
      <Image
        source={focused ? art.active : art.inactive}
        style={[{ width: s, height: s }, style]}
        contentFit="contain"
        // The tab bar swaps these on every press; a fade would read as a flicker.
        transition={0}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const glyph = (focused === false ? `${name}-outline` : name) as IoniconName;
  return <Ionicons name={glyph} size={size} color={color} />;
}
