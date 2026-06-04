// Design tokens for LOGOS — single source of truth for all visual decisions.
// Extend this file as the design is refined; never hardcode colour / shadow /
// timing values in components.

// ─── Palette (primitives) ───────────────────────────────────────────────────

export const PALETTE = {
  // Backgrounds — "Quest": near-black so vibrant reward colors pop
  bg:      '#0E0F14',
  bgSec:   '#181B22',
  bgTer:   '#252A34',

  // Brand — gamified multi-accent reward system
  accent:  '#3D7BFF', // electric blue — CTAs, highlights, active states
  gold:    '#FFC53D', // bright marigold — XP, levels, achievements
  ember:   '#FF6B4A', // coral streak-flame
  level:   '#FF4D8D', // magenta — level-up / celebration pops

  // Text — cool white + cool grays
  text:    '#F4F6FB',
  textSec: '#A7AEBE',
  textTer: '#6E748A',

  // Semantic
  danger:  '#E5484D', // clear red, distinct from the coral streak
  warning: '#FFB020',
  success: '#3D7BFF', // alias for accent

  // Alpha surfaces — pre-mixed so components avoid inline rgba() strings
  accentAlpha10: 'rgba(61,123,255,0.10)',  // ambient background blobs
  accentAlpha16: 'rgba(61,123,255,0.16)',  // avatar chip, selection rings
  accentAlpha18: 'rgba(61,123,255,0.20)',  // hero card glow halo
  goldAlpha06:   'rgba(255,197,61,0.07)',  // ambient background blobs

  // Surfaces
  glass:      'rgba(24,27,34,0.92)',      // session control bar
  cardBorder: 'rgba(255,255,255,0.07)',   // hairline top-lit border
  onAccent:   '#FFFFFF',                 // text / icons on the vivid accent fills

  // Accent gradient (Start Reading CTA, highlights)
  accentGradStart: '#4D87FF',
  accentGradEnd:   '#2E6BF0',

  // Skeleton shimmer
  skeletonBase:    '#181B22',
  skeletonShimmer: '#252A34',

  // Share card
  cardTransparentBadgeBg: 'rgba(255,255,255,0.20)',
  cardDarkBadgeBg: '#FFC53D',
  cardDarkBg:      '#0E0F14',

  // System
  shadowColor: '#000000',
  overlay:     'rgba(6,7,10,0.62)',
} as const;

// Background gradient layers for ScreenBackground — near-black with a faint lift.
export const BG_GRADIENT = {
  colors:    ['#16181F', '#0F1116', '#0B0C10'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

// Light-mode counterpart — clean cool off-white (pairs with the electric blue).
export const BG_GRADIENT_LIGHT = {
  colors:    ['#FFFFFF', '#F4F6FA', '#EAEEF4'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

// Font families — must match the keys loaded via useFonts in app/_layout.tsx.
// Literary display (Cormorant Garamond) → identity surfaces: welcome, level-name
//   reveals, Year-in-Books, celebratory headlines.
// Inter → all functional UI, body text, and numerics (tabular figures for stats).
export const FONTS = {
  displayMedium:   'CormorantGaramond_500Medium',
  displaySemiBold: 'CormorantGaramond_600SemiBold',
  displayBold:     'CormorantGaramond_700Bold',
  uiRegular:       'Inter_400Regular',
  uiMedium:        'Inter_500Medium',
  uiSemiBold:      'Inter_600SemiBold',
  uiBold:          'Inter_700Bold',
} as const;

export const FONT_SIZE = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
} as const;

// Companion line-height scale — maintains consistent vertical rhythm.
// Each key pairs with the same FONT_SIZE key.
export const LINE_HEIGHT = {
  xs:   14,
  sm:   16,
  md:   20,
  base: 24,
  lg:   26,
  xl:   30,
  '2xl': 36,
  '3xl': 44,
  '4xl': 56,
} as const;

// ─── Spacing & Layout ────────────────────────────────────────────────────────

export const SPACING = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const RADIUS = {
  sm:   6,
  md:   12,
  lg:   16,
  card: 22,  // elevated cards: Card, ReadingInsightCard, SessionControlBar
  xl:   24,
  full: 9999,
} as const;

// ─── Elevation / Shadow ──────────────────────────────────────────────────────
// Spread into StyleSheet.create() objects, e.g. `...SHADOW.card`.

export const SHADOW = {
  card: {
    shadowColor:   PALETTE.shadowColor,
    shadowOpacity: 0.35,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     8,
  },
  sm: {
    shadowColor:   PALETTE.shadowColor,
    shadowOpacity: 0.20,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     4,
  },
} as const;

// ─── Animation ───────────────────────────────────────────────────────────────

export const ANIMATION = {
  // Durations (ms)
  durationFast:    90,    // press-in / press-out scale feedback
  durationQuick:   150,   // icon swaps, colour transitions
  durationNormal:  280,   // modal/sheet exits, slide dismissals
  durationSlow:    460,   // entrance animations (FadeInUp stagger)
  durationAmbient: 1100,  // ambient pulses (streak flame, background blobs)

  // Spring presets (react-native-reanimated withSpring)
  springSnappy: { damping: 18, stiffness: 160 },
  springSmooth: { damping: 18, stiffness: 140 },
  springBouncy: { damping: 12, stiffness: 180 },

  // Stagger delay per list item (ms)
  staggerStep: 80,
} as const;

// ─── Theme tokens ─────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeTokens {
  // Backgrounds
  bg:      string;
  bgSec:   string;
  bgTer:   string;

  // Brand
  accent: string;
  gold:   string;

  // Text
  text:    string;
  textSec: string;
  textTer: string;

  // Semantic
  danger:  string;
  warning: string;
  success: string;

  // Structural
  border:  string;
  overlay: string;

  // Surfaces
  glass:       string;  // semi-transparent dark surface (session bar, glass sheets)
  accentMuted: string;  // 16% accent alpha (avatar chips, selection rings)
  onAccent:    string;  // text / icons placed on accent-coloured surfaces

  mode: 'dark' | 'light';
}

export const DARK_TOKENS: ThemeTokens = {
  bg:     PALETTE.bg,
  bgSec:  PALETTE.bgSec,
  bgTer:  PALETTE.bgTer,
  accent: PALETTE.accent,
  gold:   PALETTE.gold,
  text:   PALETTE.text,
  textSec: PALETTE.textSec,
  textTer: PALETTE.textTer,
  danger:  PALETTE.danger,
  warning: PALETTE.warning,
  success: PALETTE.success,
  border:  PALETTE.bgTer,
  overlay: PALETTE.overlay,
  glass:       PALETTE.glass,
  accentMuted: PALETTE.accentAlpha16,
  onAccent:    PALETTE.onAccent,
  mode: 'dark',
} as const;

export const LIGHT_TOKENS: ThemeTokens = {
  bg:      '#F7F9FC',
  bgSec:   '#FFFFFF',
  bgTer:   '#EAEEF4',
  accent:  '#2563EB',   // deeper blue so white CTA text passes WCAG AA on light
  gold:    '#B7860B',
  text:    '#11131A',
  textSec: '#5A6275',
  textTer: '#9AA0B0',
  danger:  '#DC2F36',
  warning: '#B5701A',
  success: '#2563EB',
  border:  '#E2E7EF',
  overlay: 'rgba(10,12,18,0.40)',
  glass:       'rgba(247,249,252,0.92)',
  accentMuted: 'rgba(37,99,235,0.12)',
  onAccent:    '#FFFFFF',
  mode: 'light',
} as const;
