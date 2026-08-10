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
 * Which theme colour a piece of art is painted in. Painted icons can't be tinted,
 * so the colour is part of the identity of the file, not a runtime prop.
 */
export type IconTint = 'accent' | 'ember' | 'gold' | 'ink' | 'muted' | 'lilac' | 'danger' | 'cream';

/**
 * Single-variant art, keyed by glyph then by the colour it's drawn in.
 *
 * `tint` is REQUIRED to get art — there is deliberately no default. Six of these
 * glyphs exist in more than one colour (flame in ember and ink, book in accent,
 * muted and ink…) and a wrong default would silently paint an ember flame onto a
 * coral fill. Ask for a tint the art doesn't have and you get the font glyph, which
 * is always a safe outcome.
 *
 * One wrinkle worth knowing: `book` at tint `ink` is an OPEN book (it's the
 * "Getting Deep" achievement) while `accent` and `muted` are closed books. Same
 * glyph name, different drawings, because they live on unrelated surfaces.
 *
 * Metro resolves image assets only from literal require() calls.
 */
const SOLID: Partial<Record<string, Partial<Record<IconTint, number>>>> = {
  alarm:            { accent: require('@/assets/ui-icons/alarm-accent.webp') },
  'bar-chart':      { accent: require('@/assets/ui-icons/bar-chart-accent.webp') },
  barcode:          { accent: require('@/assets/ui-icons/barcode-accent.webp') },
  bulb:             { accent: require('@/assets/ui-icons/bulb-accent.webp') },
  book:             { accent: require('@/assets/ui-icons/book-accent.webp'),
                      muted:  require('@/assets/ui-icons/book-muted.webp'),
                      ink:    require('@/assets/ui-icons/book-open-ink.webp') },
  bookmarks:        { accent: require('@/assets/ui-icons/bookmarks-accent.webp'),
                      muted:  require('@/assets/ui-icons/bookmarks-muted.webp') },
  business:         { accent: require('@/assets/ui-icons/business-accent.webp') },
  calendar:         { accent: require('@/assets/ui-icons/calendar-accent.webp'),
                      ink:    require('@/assets/ui-icons/calendar-ink.webp') },
  'checkmark-done': { gold:   require('@/assets/ui-icons/checkmark-done-gold.webp') },
  'chatbubble-ellipses': { accent: require('@/assets/ui-icons/chatbubble-ellipses-accent.webp') },
  'cloud-offline':  { muted:  require('@/assets/ui-icons/cloud-offline-muted.webp') },
  download:         { muted:  require('@/assets/ui-icons/download-muted.webp') },
  flag:             { gold:   require('@/assets/ui-icons/flag-gold.webp') },
  flame:            { cream:  require('@/assets/ui-icons/flame-cream.webp'),
                      ember:  require('@/assets/ui-icons/flame-ember.webp'),
                      ink:    require('@/assets/ui-icons/flame-ink.webp') },
  flash:            { ink:    require('@/assets/ui-icons/flash-ink.webp') },
  footsteps:        { ink:    require('@/assets/ui-icons/footsteps-ink.webp') },
  globe:            { accent: require('@/assets/ui-icons/globe-accent.webp') },
  library:          { gold:   require('@/assets/ui-icons/library-gold.webp'),
                      ink:    require('@/assets/ui-icons/library-ink.webp') },
  'log-out':        { ink:    require('@/assets/ui-icons/log-out-ink.webp') },
  mail:             { muted:  require('@/assets/ui-icons/mail-muted.webp') },
  medal:            { ink:    require('@/assets/ui-icons/medal-ink.webp') },
  moon:             { ink:    require('@/assets/ui-icons/moon-ink.webp') },
  notifications:    { accent: require('@/assets/ui-icons/notifications-accent.webp') },
  person:           { accent: require('@/assets/ui-icons/person-accent.webp') },
  'phone-portrait': { ink:    require('@/assets/ui-icons/phone-portrait-ink.webp') },
  pricetag:         { accent: require('@/assets/ui-icons/pricetag-accent.webp') },
  reader:           { accent: require('@/assets/ui-icons/reader-accent.webp') },
  ribbon:           { gold:   require('@/assets/ui-icons/ribbon-gold.webp'),
                      ink:    require('@/assets/ui-icons/ribbon-ink.webp') },
  sparkles:         { accent: require('@/assets/ui-icons/sparkles-accent.webp') },
  sunny:            { ink:    require('@/assets/ui-icons/sunny-ink.webp') },
  settings:         { accent: require('@/assets/ui-icons/settings-accent.webp') },
  speedometer:      { lilac:  require('@/assets/ui-icons/speedometer-lilac.webp') },
  star:             { gold:   require('@/assets/ui-icons/star-gold.webp') },
  time:             { accent: require('@/assets/ui-icons/time-accent.webp'),
                      ember:  require('@/assets/ui-icons/time-ember.webp') },
  trash:            { danger: require('@/assets/ui-icons/trash-danger.webp') },
  trophy:           { gold:   require('@/assets/ui-icons/trophy-gold.webp'),
                      ink:    require('@/assets/ui-icons/trophy-ink.webp') },
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
  /** Which painted variant to use. Required to get art — omit it and you get the
   *  font glyph. Must match the colour the call site would otherwise have passed. */
  tint?: IconTint;
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
export function AppIcon({ name, focused, tint, size = 24, color, style }: AppIconProps) {
  // Call sites name the FILLED glyph in some places and the -outline one in others
  // ("reader" vs "reader-outline"). The painted art draws no such distinction, so
  // the registry is keyed on the base name and the suffix is stripped for lookup.
  const base = name.replace(/-outline$/, '');
  // `focused` is what distinguishes the two registries: pass it and you're asking
  // for a two-state tab icon, omit it and you get the single-variant art (if any).
  const pair = focused === undefined ? undefined : CUSTOM[base];
  const source = pair
    ? focused
      ? pair.active
      : pair.inactive
    : focused === undefined && tint
      ? SOLID[base]?.[tint]
      : undefined;

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
