// Which Q, and which words, on the session Success screen.
//
// A priority ladder: OUTCOME beats EFFORT, so a personal best on a short session
// still earns the big reaction. First match wins, top to bottom.
//
// Written as a declarative table rather than a chain of ifs on purpose — the order
// IS the rule, so re-ranking a tier is a line move rather than a re-read of nested
// conditions, and every tier is forced to declare the same fields.
//
// ── Artwork ───────────────────────────────────────────────────────────────────
// Six poses are commissioned but not yet drawn. Each tier below therefore points at
// the closest EXISTING expression so the ladder works today, with the intended file
// named in `art`. When a pose lands: add it to Q.tsx's SOURCES, then change that
// tier's `expression` to the new key. Nothing else moves.
//
//   tier              intended art          rendering as (today)
//   finished-book     q-book-finished       proud
//   personal-best     q-personal-best       surprised
//   achievement       q-medal               proud
//   marathon          q-marathon            confident
//   big               q-celebrating         happy
//   audiobook         q-headphones          happy
//   late-night        —                     sleepy      ✓ final
//   solid             q-thumbsup            happy
//   everyday          —                     happy       ✓ final

import type { QExpression } from '@/components/shared/Q';

export interface CelebrationContext {
  /** The reader marked the book finished on the Review screen. */
  finishedBook: boolean;
  isPersonalBest: boolean;
  badgeCount: number;
  durationSeconds: number;
  /** Null for audiobooks. */
  pagesRead: number | null;
  isAudiobook: boolean;
  /** 0–23, device-local. Drives the late-night tier. */
  localHour: number;
}

export interface Celebration {
  key: string;
  expression: QExpression;
  headline: string;
  /** Reward hue behind Q. Gold is reserved for the top two rungs. */
  halo: 'coral' | 'gold';
}

interface Tier extends Celebration {
  when: (c: CelebrationContext) => boolean;
}

const MIN = 60;

const LADDER: Tier[] = [
  {
    key: 'finished-book',
    when: (c) => c.finishedBook,
    expression: 'proud', // → q-book-finished
    headline: 'You finished it',
    halo: 'gold',
  },
  {
    key: 'personal-best',
    when: (c) => c.isPersonalBest,
    expression: 'surprised', // → q-personal-best
    headline: 'Personal best',
    halo: 'gold',
  },
  {
    key: 'achievement',
    when: (c) => c.badgeCount > 0,
    expression: 'proud', // → q-medal
    headline: 'Achievement unlocked',
    halo: 'gold',
  },
  {
    key: 'marathon',
    when: (c) => c.durationSeconds >= 60 * MIN || (c.pagesRead ?? 0) >= 40,
    expression: 'confident', // → q-marathon
    headline: 'That was a session',
    halo: 'coral',
  },
  {
    key: 'big',
    when: (c) => c.durationSeconds >= 30 * MIN || (c.pagesRead ?? 0) >= 20,
    expression: 'happy', // → q-celebrating
    headline: 'Great run',
    halo: 'coral',
  },
  {
    key: 'audiobook',
    when: (c) => c.isAudiobook,
    expression: 'happy', // → q-headphones
    headline: 'Listened well',
    halo: 'coral',
  },
  {
    // Below the size tiers deliberately: a 90-minute session at midnight is a
    // marathon first and a late night second.
    key: 'late-night',
    when: (c) => c.localHour >= 22 || c.localHour < 5,
    expression: 'sleepy',
    headline: 'Burning the midnight oil',
    halo: 'coral',
  },
  {
    key: 'solid',
    when: (c) => c.durationSeconds >= 10 * MIN || (c.pagesRead ?? 0) >= 8,
    expression: 'happy', // → q-thumbsup
    headline: 'Nice work',
    halo: 'coral',
  },
  {
    key: 'everyday',
    when: () => true, // the floor — most nights land here, and that's the point
    expression: 'happy',
    headline: 'Session logged',
    halo: 'coral',
  },
];

export function celebrationFor(c: CelebrationContext): Celebration {
  // `everyday` matches unconditionally, so the find always resolves.
  const tier = LADDER.find((t) => t.when(c)) ?? LADDER[LADDER.length - 1];
  const { when, ...celebration } = tier;
  return celebration;
}
