// Design tokens for LOGOS — single source of truth for all visual decisions.
// Extend this file as the design is refined; never hardcode colour / shadow /
// timing values in components.
//
// VISUAL LANGUAGE — PAPER & INK (soft-brutalism, light-first).
// Warm oat-paper substrate, warm soft-black ink, FLAT reward-colour blocks
// (coral / marigold / ember / lilac), thick ink borders, SOFTLY-ROUNDED corners,
// and HARD offset drop-shadows warmed to ink (no blur on most surfaces; the
// hero Card adds a whisper of ambient depth). The bones of neubrutalism —
// ink borders + offset shadows — kept; the temperature warmed and corners
// rounded so it reads like a well-loved reading journal that keeps score.
// Type is Space Grotesk (headers/UI) + JetBrains Mono (data/labels) +
// Cormorant Garamond (editorial serif for hero display moments only).

// ─── Palette (primitives) ───────────────────────────────────────────────────

export const PALETTE = {
  // Warm-dark substrate (dark-mode fallback — light is the primary mode)
  bg:      '#1B1712',
  bgSec:   '#241E17',
  bgTer:   '#2F2718',

  // Brand — FLAT reward blocks (shared across light/dark; never gradients)
  accent:  '#F0764F', // coral — actions, CTAs, active states (warm, inviting)
  gold:    '#F3C24C', // marigold — XP, levels, achievements (ink text on fill)
  ember:   '#F2913F', // amber — streak flame (warm, distinct from the coral primary)
  level:   '#9A7BD6', // lilac — level-up / celebration pops

  // Ink / paper primitives
  ink:     '#241E19', // warm soft-black — borders + text + hard shadow
  paper:   '#F6EEDF', // warm oat documentation paper

  // Text (dark-mode)
  text:    '#F4EFE3',
  textSec: '#B3AA98',
  textTer: '#7E7566',

  // Semantic
  danger:  '#C1352A', // deep brick-crimson — cooler/deeper than the warm coral primary
  warning: '#E0912F',
  success: '#F0764F', // alias for accent

  // Block tints (kept names for compatibility; flat pale blocks, no glow)
  accentAlpha10: 'rgba(240,118,79,0.10)',
  accentAlpha16: 'rgba(240,118,79,0.16)',
  accentAlpha18: 'rgba(240,118,79,0.20)',
  goldAlpha06:   'rgba(243,194,60,0.12)',

  // Surfaces
  glass:      '#241E17',   // SOLID surface (session control bar) — no translucency
  cardBorder: '#241E19',   // ink border
  onAccent:   '#241E19',   // INK text / icons on the warm coral fills (Paper & Ink signature)

  // Accent "gradient" — flattened to a single colour (kept keys for compatibility)
  accentGradStart: '#F0764F',
  accentGradEnd:   '#F0764F',

  // Skeleton shimmer (warm light substrate). Deliberately a few steps deeper than
  // bgTer — the oat paper bg is so close in tone that an inset-cream block would
  // barely read as a placeholder.
  skeletonBase:    '#E7DAC1',
  skeletonShimmer: '#DBCBAC',

  // Share card
  cardTransparentBadgeBg: 'rgba(255,255,255,0.22)',
  cardDarkBadgeBg: '#F3C24C',
  cardDarkBg:      '#241E19',

  // System
  shadowColor: '#241E19',
  overlay:     'rgba(28,22,16,0.55)',
} as const;

// Background "gradients" — flattened to a single flat fill per mode (soft-brutalism
// still rejects gradients on the substrate). Kept as 3-stop shapes so existing
// call-sites still type.
export const BG_GRADIENT = {
  colors:    ['#1B1712', '#1B1712', '#1B1712'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

export const BG_GRADIENT_LIGHT = {
  colors:    ['#F6EEDF', '#F6EEDF', '#F6EEDF'] as const,
  locations: [0, 0.5, 1] as const,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

// Font families — must match the keys loaded via useFonts in app/_layout.tsx.
// Schibsted Grotesk → all headers + UI + body (a warm editorial grotesk; set
//   UPPERCASE for impact on structural labels). JetBrains Mono → data, metadata,
//   labels, numerics, "telemetry" readouts (tabular by nature; pair with
//   letter-spacing). Fraunces → editorial serif with optical sizing for HERO
//   DISPLAY moments only (greetings, section titles, celebration headlines,
//   book-ish blurbs ≥18px). Never for small UI/labels.
export const FONTS = {
  displayMedium:   'SchibstedGrotesk_500Medium',
  displaySemiBold: 'SchibstedGrotesk_600SemiBold',
  displayBold:     'SchibstedGrotesk_700Bold',
  uiRegular:       'SchibstedGrotesk_400Regular',
  uiMedium:        'SchibstedGrotesk_500Medium',
  uiSemiBold:      'SchibstedGrotesk_600SemiBold',
  uiBold:          'SchibstedGrotesk_700Bold',
  mono:            'JetBrainsMono_400Regular',
  monoMedium:      'JetBrainsMono_500Medium',
  monoBold:        'JetBrainsMono_700Bold',
  serif:           'Fraunces_600SemiBold',
  serifMedium:     'Fraunces_500Medium',
  serifBold:       'Fraunces_700Bold',
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

// Soft-brutalism: gently ROUNDED corners (the cozy warmth over neubrutalism's
// sharp 90°). Scale by element weight — small tags → sm, cards/sheets → card/xl,
// pills/avatars → full. The shared primitives read from here; screen styles that
// still hardcode a radius should migrate to these tokens over time.
export const RADIUS = {
  sm:   10,   // chips, small tags, tight controls
  md:   14,   // buttons, inputs, tiles, list rows (the universal default)
  lg:   18,   // prominent controls, medium surfaces
  card: 20,   // the standard Card surface
  xl:   26,   // sheets, hero surfaces, celebration cards
  full: 9999, // avatars, FAB, pills, the streak-flame ring
} as const;

// Structural borders — thick, solid ink. Spread or read per component.
export const BORDER_WIDTH = 2;
export const BORDER_WIDTH_THICK = 3;
export const INK = '#241E19';

// Android adds extra vertical padding inside a text's line box, which makes
// single-line labels sit slightly high in fixed-height pills / buttons / tabs
// (iOS ignores this). Spread into those single-line text styles so they centre
// identically on both platforms. Do NOT use on multi-line / large display text
// (it can clip tall ascenders/descenders when line-height is tight).
export const NO_FONT_PAD = { includeFontPadding: false } as const;

// ─── Elevation / Shadow ──────────────────────────────────────────────────────
// HARD offset shadows (no blur) via the RN `boxShadow` prop (New Architecture).
// Spread into StyleSheet.create() objects, e.g. `...SHADOW.card`. These render
// on the warm light substrate; the shared Card recomputes the colour per-theme
// and adds a whisper of ambient depth on top of the hard offset.

export const SHADOW = {
  card: { boxShadow: '4px 4px 0px #241E19' },
  sm:   { boxShadow: '2px 3px 0px #241E19' },
  lg:   { boxShadow: '6px 6px 0px #241E19' },
} as const;

// Helper for theme-aware hard shadows (light → warm ink, dark → black).
export function hardShadow(color: string, offset = 4): { boxShadow: string } {
  return { boxShadow: `${offset}px ${offset}px 0px ${color}` };
}

// Hero shadow: the hard ink offset PLUS a whisper of warm ambient depth beneath.
// Reserved for the primary Card surface so big blocks feel like paper lifted off
// the page, without the flat harshness of a pure offset. Keep off small/dense
// tiles (perf + hierarchy).
export function softStackShadow(color: string, offset = 4): { boxShadow: string } {
  return {
    boxShadow: `${offset}px ${offset}px 0px ${color}, 0px ${offset * 3}px ${offset * 4.5}px -${offset * 2.5}px rgba(36,30,25,0.30)`,
  };
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
  bg:      '#F6EEDF',  // warm oat paper
  bgSec:   '#FCF8ED',  // warm cream card (not stark white — softer, premium)
  bgTer:   '#F0E6D3',  // inset cream
  accent:  '#F0764F',  // coral
  gold:    '#C8892C',  // readable marigold for text/icons (bright #F3C24C for fills/stars)
  ember:   '#D9730F',  // readable amber for text/icons on light
  level:   '#8257C7',  // readable lilac-violet for text on light
  text:    '#241E19',  // warm soft-black ink
  textSec: '#6E6250',  // warm secondary
  textTer: '#9A8E79',  // warm tertiary
  danger:  '#B4271B',  // deep crimson — distinct from the coral primary
  warning: '#B5701A',
  success: '#F0764F',
  border:  '#241E19',  // INK — bold warm-black borders everywhere
  ink:     '#241E19',
  overlay: 'rgba(28,22,16,0.55)',
  glass:       '#FCF8ED',
  accentMuted: '#FBE0D3',  // pale coral selection block
  onAccent:    '#241E19',  // INK text on the warm coral fills (Paper & Ink signature)
  mode: 'light',
} as const;

export const DARK_TOKENS: ThemeTokens = {
  bg:      PALETTE.bg,
  bgSec:   PALETTE.bgSec,
  bgTer:   PALETTE.bgTer,
  accent:  '#F6875D',  // brighter coral on the warm-dark substrate
  gold:    PALETTE.gold,
  ember:   '#FF9A45',
  level:   '#B79BE6',  // lighter lilac on dark
  text:    PALETTE.text,
  textSec: PALETTE.textSec,
  textTer: PALETTE.textTer,
  danger:  '#E5675A',  // warmer red on dark — still distinct from coral
  warning: PALETTE.warning,
  success: '#F6875D',
  border:  '#4A4030',  // visible warm compartmentalization on dark
  ink:     '#000000',
  overlay: 'rgba(0,0,0,0.62)',
  glass:       PALETTE.glass,
  accentMuted: 'rgba(246,135,93,0.20)',
  onAccent:    '#201A13',  // near-ink text on the coral fills (consistent with light)
  mode: 'dark',
} as const;
