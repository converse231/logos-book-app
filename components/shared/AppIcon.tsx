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

/**
 * Single-variant art: one baked-in colour, no focused/unfocused pair.
 *
 * Because the colour is painted in, these can only stand in where the call site
 * already wanted that exact colour — the ember flame, the gold trophy/ribbon/star,
 * the coral sparkle. `flame` in particular is drawn in seven different tints across
 * the app; the other six call sites must stay on the font glyph, so DON'T blanket
 * replace Ionicons with AppIcon. Check the colour first.
 */
const SOLID: Partial<Record<string, number>> = {
  flame: require('@/assets/ui-icons/flame-ember.webp'),
  trophy: require('@/assets/ui-icons/trophy-gold.webp'),
  sparkles: require('@/assets/ui-icons/sparkles-accent.webp'),
  ribbon: require('@/assets/ui-icons/ribbon-gold.webp'),
  star: require('@/assets/ui-icons/star-gold.webp'),
};

/** The art is fitted to a fraction of its canvas so nothing clips, so drawing it at
 *  the nominal size would make it read smaller than an Ionicon beside it. Tab art is
 *  fitted to 90%, the ui-icons to 88%. */
const ART_SCALE = 1 / 0.9;
const SOLID_SCALE = 1 / 0.88;

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
  // `focused` is what distinguishes the two registries: pass it and you're asking
  // for a two-state tab icon, omit it and you get the single-variant art (if any).
  const pair = focused === undefined ? undefined : CUSTOM[name];
  const source = pair ? (focused ? pair.active : pair.inactive) : focused === undefined ? SOLID[name] : undefined;

  if (source) {
    const s = Math.round(size * (pair ? ART_SCALE : SOLID_SCALE));
    return (
      <Image
        source={source}
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
