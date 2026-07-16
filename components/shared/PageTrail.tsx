import { StyleSheet, View } from 'react-native';
import { PALETTE } from '@/theme/tokens';

interface PageTrailProps {
  /** Total pages in the book — the full length of the trail. */
  pageCount: number;
  /** Page the reader was on when this session began. */
  startPage: number;
  /** Page they reached — the bright coral run is startPage → endPage. */
  endPage: number;
  width: number;
  /** Bar height for the tallest (session) ticks. Defaults to a 4:5-card-friendly ratio. */
  height?: number;
  accent?: string;
}

// "Your route through the book" — the signature share-card mark.
//
// The whole book is drawn as its fore-edge: a strip of page-edge ticks. Pages read
// before this session are mid-tone, THIS session's run is full-height coral, and
// what's left of the book stays faint. Every session produces a different mark
// (book length × where you were × how far you got), which is the whole point — a
// static logo is the same on everyone's card; this one is only ever yours.
//
// Purely derived from data the session already carries (startPage / pageCount) —
// no schema change.
const TICKS = 120;
const MIN_SESSION_TICKS = 3; // a short read still has to be visible on the strip

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function PageTrail({
  pageCount,
  startPage,
  endPage,
  width,
  height,
  accent = PALETTE.accent,
}: PageTrailProps) {
  const total = Math.max(1, pageCount);
  const start = clamp(startPage, 0, total);
  const end = clamp(endPage, start, total);

  const barH = height ?? width * 0.15;
  const gap = Math.max(1, width * 0.004);
  const tickW = Math.max(1, (width - (TICKS - 1) * gap) / TICKS);

  // Map the session onto tick indices, guaranteeing the run never vanishes on a
  // long book (Strava zooms to the route; we keep a floor instead).
  const iStart = Math.floor((start / total) * TICKS);
  let iEnd = Math.ceil((end / total) * TICKS);
  if (iEnd - iStart < MIN_SESSION_TICKS) iEnd = Math.min(TICKS, iStart + MIN_SESSION_TICKS);

  return (
    <View style={[styles.row, { width, height: barH, gap }]}>
      {Array.from({ length: TICKS }).map((_, i) => {
        const kind = i < iStart ? 'before' : i < iEnd ? 'session' : 'unread';
        return (
          <View
            key={i}
            style={{
              width: tickW,
              height: kind === 'session' ? barH : kind === 'before' ? barH * 0.5 : barH * 0.26,
              borderRadius: tickW / 2,
              backgroundColor:
                kind === 'session'
                  ? accent
                  : kind === 'before'
                    ? 'rgba(255,255,255,0.62)'
                    : 'rgba(255,255,255,0.26)',
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
