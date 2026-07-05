// Design tokens for LOGOS — single source of truth for all visual decisions.
// Extend this file as the design is refined; never hardcode colour / shadow /
// timing values in components.
//
// VISUAL LANGUAGE — NEUBRUTALISM (light).
// Off-white paper substrate, near-black ink, FLAT reward-colour blocks
// (blue / coral / gold / magenta), thick ink borders, SHARP 90° corners, and
// HARD offset drop-shadows (no blur). No gradients, no glass/blur, no soft
// shadows. Type is Space Grotesk (headers/UI) + JetBrains Mono (data/labels).

// ─── Palette (primitives) ───────────────────────────────────────────────────

export const PALETTE = {
  // Dark substrate (dark-mode fallback — light is the primary mode)
  bg:      '#161616',
  bgSec:   '#1E1E1E',
  bgTer:   '#2A2A2A',

  // Brand — FLAT reward blocks (shared across light/dark; never gradients)
  accent:  '#FF3D1F', // vermilion — actions, CTAs, active states (aviation/hazard energy)
  gold:    '#FFC53D', // marigold — XP, levels, achievements (black text on fill)
  ember:   '#FF8A1E', // amber — streak flame (warm, distinct from the vermilion primary)
  level:   '#E5327A', // magenta — level-up / celebration pops

  // Ink / paper primitives
  ink:     '#141414', // borders + text on light substrate
  paper:   '#F4F1E8', // off-white documentation paper

  // Text (dark-mode)
  text:    '#F4F2EC',
  textSec: '#ADA89C',
  textTer: '#736E62',

  // Semantic
  danger:  '#E5484D', // distinct red (crimson on light) — never the vermilion primary
  warning: '#FF9F1C',
  success: '#FF3D1F', // alias for accent

  // Block tints (kept names for compatibility; now flat pale blocks, no glow)
  accentAlpha10: 'rgba(255,61,31,0.10)',
  accentAlpha16: 'rgba(255,61,31,0.16)',
  accentAlpha18: 'rgba(255,61,31,0.20)',
  goldAlpha06:   'rgba(255,197,61,0.12)',

  // Surfaces
  glass:      '#1E1E1E',   // SOLID surface (session control bar) — no translucency
  cardBorder: '#141414',   // ink border
  onAccent:   '#FFFFFF',   // text / icons on the vivid accent fills

  // Accent "gradient" — flattened to a single colour (kept keys for compatibility)
  accentGradStart: '#FF3D1F',
  accentGradEnd:   '#FF3D1F',

  // Skeleton shimmer (light substrate)
  skeletonBase:    '#E9E4D6',
  skeletonShimmer: '#DBD4C2',

  // Share card
  cardTransparentBadgeBg: 'rgba(255,255,255,0.22)',
  cardDarkBadgeBg: '#FFC53D',
  cardDarkBg:      '#141414',

  // System
  shadowColor: '#141414',
  overlay:     'rgba(20,18,16,0.55)',
} as const;

// Background "gradients" — flattened to a single flat fill per mode (brutalism
// rejects gradients). Kept as 3-stop shapes so existing call-sites still type.
export const BG_GRADIENT = {
  colors:    ['#161616', '#161616', '#161616'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

export const BG_GRADIENT_LIGHT = {
  colors:    ['#F4F1E8', '#F4F1E8', '#F4F1E8'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

// Font families — must match the keys loaded via useFonts in app/_layout.tsx.
// Space Grotesk → all headers + UI + body (grotesk, set UPPERCASE for impact on
//   structural headers). JetBrains Mono → data, metadata, labels, numerics,
//   "telemetry" readouts (tabular by nature; pair with letter-spacing).
export const FONTS = {
  displayMedium:   'SpaceGrotesk_500Medium',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  displayBold:     'SpaceGrotesk_700Bold',
  uiRegular:       'SpaceGrotesk_400Regular',
  uiMedium:        'SpaceGrotesk_500Medium',
  uiSemiBold:      'SpaceGrotesk_600SemiBold',
  uiBold:          'SpaceGrotesk_700Bold',
  mono:            'JetBrainsMono_400Regular',
  monoMedium:      'JetBrainsMono_500Medium',
  monoBold:        'JetBrainsMono_700Bold',
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

// Brutalism: SHARP corners everywhere. `full` is retained only for the few
// intentionally-circular elements (avatars, FAB, the streak-flame ring).
export const RADIUS = {
  sm:   0,
  md:   0,
  lg:   0,
  card: 0,
  xl:   0,
  full: 9999,
} as const;

// Structural borders — thick, solid ink. Spread or read per component.
export const BORDER_WIDTH = 2;
export const BORDER_WIDTH_THICK = 3;
export const INK = '#141414';

// ─── Elevation / Shadow ──────────────────────────────────────────────────────
// HARD offset shadows (no blur) via the RN `boxShadow` prop (New Architecture).
// Spread into StyleSheet.create() objects, e.g. `...SHADOW.card`. These render
// on the light substrate; the shared Card recomputes the colour per-theme.

export const SHADOW = {
  card: { boxShadow: '4px 4px 0px #141414' },
  sm:   { boxShadow: '2px 2px 0px #141414' },
  lg:   { boxShadow: '6px 6px 0px #141414' },
} as const;

// Helper for theme-aware hard shadows (light → ink, dark → black).
export function hardShadow(color: string, offset = 4): { boxShadow: string } {
  return { boxShadow: `${offset}px ${offset}px 0px ${color}` };
}

// ─── Animation ───────────────────────────────────────────────────────────────

export const ANIMATION = {
  // Durations (ms)
  durationFast:    90,    // press-in / press-out scale feedback
  durationQuick:   150,   // icon swaps, colour transitions
  durationNormal:  280,   // modal/sheet exits, slide dismissals
  durationSlow:    460,   // entrance animations (FadeInUp stagger)
  durationAmbient: 1100,  // ambient pulses (streak flame)

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

  // Brand (flat reward blocks)
  accent: string;
  gold:   string;
  ember:  string;
  level:  string;

  // Text
  text:    string;
  textSec: string;
  textTer: string;

  // Semantic
  danger:  string;
  warning: string;
  success: string;

  // Structural
  border:  string;  // thick-border ink colour for this mode
  ink:     string;  // shadow / hard-edge ink for this mode
  overlay: string;

  // Surfaces
  glass:       string;  // SOLID surface (session bar) — no translucency
  accentMuted: string;  // pale selection block
  onAccent:    string;  // text / icons placed on accent-coloured fills

  mode: 'dark' | 'light';
}

export const LIGHT_TOKENS: ThemeTokens = {
  bg:      '#F4F1E8',  // warm documentation paper
  bgSec:   '#FFFFFF',  // white blocks
  bgTer:   '#ECE7DA',  // inset cream
  accent:  '#FF3D1F',
  gold:    '#F5A623',  // vivid amber-gold for text/icons (bright #FFC53D for fills/stars)
  ember:   '#D9730F',  // readable amber for text/icons on light
  level:   '#D62E6F',  // deeper magenta for text on light
  text:    '#141414',
  textSec: '#57534A',
  textTer: '#8B8678',
  danger:  '#B81414',  // deep crimson — distinct from the vermilion primary
  warning: '#B5701A',
  success: '#FF3D1F',
  border:  '#141414',  // INK — bold black borders everywhere
  ink:     '#141414',
  overlay: 'rgba(20,18,16,0.55)',
  glass:       '#FFFFFF',
  accentMuted: '#FFE0D8',  // pale vermilion selection block
  onAccent:    '#FFFFFF',
  mode: 'light',
} as const;

export const DARK_TOKENS: ThemeTokens = {
  bg:      PALETTE.bg,
  bgSec:   PALETTE.bgSec,
  bgTer:   PALETTE.bgTer,
  accent:  '#FF5436',  // brighter vermilion on the dark substrate
  gold:    PALETTE.gold,
  ember:   PALETTE.ember,
  level:   PALETTE.level,
  text:    PALETTE.text,
  textSec: PALETTE.textSec,
  textTer: PALETTE.textTer,
  danger:  '#E5484D',  // true red — distinct from the orange-red primary
  warning: PALETTE.warning,
  success: '#FF5436',
  border:  '#454239',  // visible compartmentalization on dark
  ink:     '#000000',
  overlay: 'rgba(0,0,0,0.62)',
  glass:       PALETTE.glass,
  accentMuted: 'rgba(255,84,54,0.22)',
  onAccent:    PALETTE.onAccent,
  mode: 'dark',
} as const;
