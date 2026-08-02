// Text colour for the share images (session card + review card).
//
// These cards are transparent PNGs dropped over the reader's own photo, so the
// only thing standing between the type and an unreadable background is its halo.
// White and vermilion sit on a DARK halo; black needs the inverse — a dark shadow
// under dark text is mud, and black type on a night photo disappears entirely.
// That inversion is the whole reason this lives in one place rather than as a
// colour prop each canvas interprets for itself.

import { PALETTE } from '@/theme/tokens';

export type CardTextColor = 'white' | 'black' | 'vermilion';

export interface CardInk {
  /** Headlines, values, titles. */
  primary: string;
  /** Labels and metadata — the same hue, stepped back. */
  secondary: string;
  /** Halo for body-sized text. */
  shadow: {
    textShadowColor: string;
    textShadowOffset: { width: number; height: number };
    textShadowRadius: number;
  };
  /** Heavier halo for the oversized headline figures. */
  headlineShadow: {
    textShadowColor: string;
    textShadowOffset: { width: number; height: number };
    textShadowRadius: number;
  };
}

const darkHalo = {
  shadow: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  headlineShadow: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
};

// Black type gets a light halo instead, so it survives a dark photo.
const lightHalo = {
  shadow: { textShadowColor: 'rgba(255,255,255,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  headlineShadow: { textShadowColor: 'rgba(255,255,255,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
};

const INKS: Record<CardTextColor, CardInk> = {
  white: { primary: '#FFFFFF', secondary: 'rgba(255,255,255,0.85)', ...darkHalo },
  // The app's warm soft-black, not #000 — pure black reads cold against the
  // Paper & Ink palette and against most photography.
  black: { primary: PALETTE.ink, secondary: 'rgba(36,30,25,0.82)', ...lightHalo },
  // The brand coral, unchanged from the accent used across the app.
  vermilion: { primary: PALETTE.accent, secondary: 'rgba(240,118,79,0.88)', ...darkHalo },
};

export const cardInk = (c: CardTextColor): CardInk => INKS[c] ?? INKS.white;
