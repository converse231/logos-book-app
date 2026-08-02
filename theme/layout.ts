// Large-screen layout rules (tablet / iPad).
//
// Quire is a phone-first, one-thumb app. On a tablet the correct move is NOT to
// stretch phone chrome across 800–1024dp — a 780dp-wide card, a 320dp book cover,
// and a full-width CTA all read as broken. Instead every screen renders its normal
// phone layout inside a CENTRED READING COLUMN capped at CONTENT_MAX_WIDTH, so
// proportions, tap targets, and type scale stay exactly as designed while the
// paper substrate (and its dot-journal texture) bleeds to the device edges.
//
// Spread CENTER_COLUMN into any block that would otherwise stretch edge-to-edge
// (screen scroll content, pinned footers, sheets, control bars). Use
// useContentWidth() wherever a layout MEASURES the screen to size children —
// grid columns, cover widths, swipe thresholds — so those maths see the column,
// never the device.

import { useWindowDimensions } from 'react-native';

// ponytail: one centred column for every screen — no two-pane (list + detail)
// tablet layouts. That's the ceiling: an iPad shows one screen at a time, same as
// a phone. Upgrade path if it's ever worth it: split Library and Stats into a
// master/detail pair behind useIsWideScreen(), leaving this clamp as the fallback.

/** Widest a content column ever gets. Above this, screens centre and gutter. */
export const CONTENT_MAX_WIDTH = 620;

/** Clamp a block to the reading column and centre it. Inert on phones (< 620dp). */
export const CENTER_COLUMN = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const;

/** Same, for a block that must also fill the available height (lists, scrollers). */
export const CENTER_COLUMN_FILL = { flex: 1, ...CENTER_COLUMN } as const;

/**
 * The width layouts should measure against: the device width on a phone, the
 * capped column on anything wider. Anything sizing children off the window
 * (grid cells, covers, gesture thresholds) must use this instead of the raw
 * window width, or it will size for a device the content never fills.
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, CONTENT_MAX_WIDTH);
}

/**
 * True once the screen is wider than the column — i.e. gutters are showing and
 * we're on a tablet. Use it to add a column (cover grids) or float a sheet off
 * the bottom edge, never to change type scale or tap targets.
 */
export function useIsWideScreen(): boolean {
  const { width } = useWindowDimensions();
  return width > CONTENT_MAX_WIDTH;
}

/** Reference phone the grids were laid out against (iPhone 14 / Pixel class). */
const DESIGN_WIDTH = 390;

/**
 * Cover-grid geometry for the library shelves. Pure so the numbers can be checked
 * without a renderer: pass the DEVICE width and the phone column count.
 *
 * A wider screen earns MORE COLUMNS, never fatter cells — the whole point is to
 * keep covers near the size they were designed at (~110dp on a 390dp phone)
 * instead of ballooning to 300dp because the shelf got 620dp to play with. The
 * column count is derived from that designed cell size rather than a tablet
 * breakpoint, so the awkward middle sizes (a 600dp 7" tablet, a resized iPad
 * window, a large foldable) are covered too instead of falling through.
 *
 * Math.max(phoneColumns, …) guarantees a phone can never lose a column.
 */
export function coverGrid(
  deviceWidth: number,
  phoneColumns: number,
  gap: number,
  gutter = 36,
): { columns: number; cellWidth: number } {
  const content = Math.min(deviceWidth, CONTENT_MAX_WIDTH);
  const designCell = (DESIGN_WIDTH - gutter - (phoneColumns - 1) * gap) / phoneColumns;
  const columns = Math.max(phoneColumns, Math.floor((content - gutter + gap) / (designCell + gap)));
  return { columns, cellWidth: (content - gutter - (columns - 1) * gap) / columns };
}
