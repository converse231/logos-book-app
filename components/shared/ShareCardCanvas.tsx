import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookCover } from './BookCover';
import { BookProgressMark } from './BookProgressMark';
import { FONTS } from '@/theme/tokens';
import { BookFormat, CardVariant } from '@/services/types';

export interface CardStats {
  headline: string; // big number/text
  headlineUnit: string; // "pages" | "minutes" | "day streak"
  sub: { label: string; value: string }[];
  bookTitle?: string;
  bookCoverUrl?: string | null;
  format?: BookFormat;
  // Where this session left the reader inside the book — drives the shape of the
  // progress mark. Present for live paged sessions; absent for audiobooks /
  // re-shares without page context (the mark then draws a neutral open book).
  pageCount?: number | null;
  startPage?: number | null;
  endPage?: number | null;
}

// 'emblem'      — the feature composition with the coral book mark standing in for
//                 the cover (for readers who don't want jacket art on a story).
// 'statsEmblem' — the same swap on the stats composition.
// The mark's shape is the signature: it's drawn from how far into the book you are.
export type CardLayout = 'feature' | 'stats' | 'emblem' | 'statsEmblem';

interface ShareCardCanvasProps {
  variant: CardVariant;
  mode: 'transparent' | 'dark';
  layout?: CardLayout;
  stats: CardStats;
  levelName: string;
  width: number; // render width; height derived 4:5
}

// The view-shot target (blueprint #28/10). 4:5 portrait, captured at 1080×1350.
// Most cards are dropped on top of the user's own story photo, so content is sized
// LARGE to read after they scale it down. Two layouts:
//   • feature — cover-led card: hero number + big book cover.
//   • stats   — Strava-style vertical stack of big numbers over the photo.
// All text carries a shadow so it stays legible over any background in overlay mode.
export const ShareCardCanvas = forwardRef<View, ShareCardCanvasProps>(
  ({ mode, layout = 'feature', stats, width }, ref) => {
    const height = width * 1.25; // 4:5
    const isDark = mode === 'dark';
    // How far into the book this session left them — the mark draws itself from
    // this. null (audiobook / re-share) → a neutral half-open book.
    const bookProgress =
      stats.pageCount && stats.endPage != null ? stats.endPage / stats.pageCount : null;

    // Hero stat + the sub-stats, as one ordered list for the vertical layout.
    const allStats = [
      { value: stats.headline, label: stats.headlineUnit },
      ...stats.sub.map((s) => ({ value: s.value, label: s.label })),
    ];

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          { width, height, padding: width * 0.06 },
          isDark ? styles.darkBg : styles.transparentBg,
        ]}
      >
        {isDark ? <View style={styles.glow} pointerEvents="none" /> : null}

        {layout === 'stats' || layout === 'statsEmblem' ? (
          // ── STATS (Strava-style vertical stack) — centered, label above value ─
          <>
            {stats.bookTitle ? (
              <Text style={[styles.statsBookTitle, textShadow, { fontSize: width * 0.05 }]} numberOfLines={2}>
                {stats.bookTitle}
              </Text>
            ) : (
              <View />
            )}

            <View style={styles.statStack}>
              {allStats.map((s, i) => (
                <View key={i} style={[styles.statItem, { marginBottom: i < allStats.length - 1 ? width * 0.03 : 0 }]}>
                  <Text style={[styles.statLabel, textShadow, { fontSize: width * 0.046 }]}>
                    {s.label.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      headlineShadow,
                      { fontSize: i === 0 ? width * 0.155 : width * 0.125, lineHeight: i === 0 ? width * 0.16 : width * 0.13 },
                    ]}
                  >
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.statsFooter}>
              {layout === 'statsEmblem' ? (
                <BookProgressMark progress={bookProgress} size={width * 0.32} />
              ) : (
                <View style={styles.coverWrap}>
                  <BookCover
                    url={stats.bookCoverUrl}
                    title={stats.bookTitle ?? 'Book'}
                    format={stats.format}
                    width={width * 0.26}
                  />
                </View>
              )}
            </View>
          </>
        ) : (
          // ── FEATURE (cover-led) ──────────────────────────────────────────────
          <>
            {/* Top: title on the left, big cover on the right. */}
            <View style={styles.top}>
              {stats.bookTitle ? (
                <Text style={[styles.bookTitle, textShadow, { fontSize: width * 0.062 }]} numberOfLines={3}>
                  {stats.bookTitle}
                </Text>
              ) : null}
              {layout === 'emblem' ? (
                <BookProgressMark progress={bookProgress} size={width * 0.34} />
              ) : stats.bookTitle ? (
                <View style={styles.coverWrap}>
                  <BookCover
                    url={stats.bookCoverUrl}
                    title={stats.bookTitle}
                    format={stats.format}
                    width={width * 0.34}
                  />
                </View>
              ) : null}
            </View>

            {/* Headline stat */}
            <View style={styles.headlineBlock}>
              <Text style={[styles.headline, headlineShadow, { fontSize: width * 0.32, lineHeight: width * 0.32 }]}>
                {stats.headline}
              </Text>
              <Text style={[styles.headlineUnit, textShadow, { fontSize: width * 0.072 }]}>
                {stats.headlineUnit}
              </Text>
            </View>

            {/* Sub-stats */}
            <View style={styles.subRow}>
              {stats.sub.map((s, i) => (
                <View key={i} style={styles.subItem}>
                  <Text style={[styles.subValue, textShadow, { fontSize: width * 0.095 }]}>{s.value}</Text>
                  <Text style={[styles.subLabel, textShadow, { fontSize: width * 0.052 }]}>{s.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

          </>
        )}
      </View>
    );
  }
);
ShareCardCanvas.displayName = 'ShareCardCanvas';

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

const headlineShadow = {
  textShadowColor: 'rgba(0,0,0,0.65)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 10,
} as const;

const styles = StyleSheet.create({
  card: { borderRadius: 14, justifyContent: 'space-between', overflow: 'hidden' },
  darkBg: { backgroundColor: '#241E19' },
  transparentBg: { backgroundColor: 'transparent' },
  glow: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    right: '15%',
    height: '50%',
    borderRadius: 14,
    backgroundColor: 'rgba(255,61,31,0.10)',
  },

  // Feature layout
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  bookTitle: { flex: 1, fontFamily: FONTS.uiSemiBold, color: '#FFFFFF' },
  coverWrap: {
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  headlineBlock: { alignItems: 'flex-start' },
  headline: { fontFamily: FONTS.uiBold, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  headlineUnit: { fontFamily: FONTS.uiMedium, color: '#FFFFFF', marginTop: 2 },
  subRow: { flexDirection: 'row', gap: 28 },
  subItem: { gap: 3 },
  subValue: { fontFamily: FONTS.uiBold, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  subLabel: { fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 },

  // Stats layout (centered, Strava-style: label above value, no dividers)
  statsBookTitle: { fontFamily: FONTS.uiSemiBold, color: '#FFFFFF', textAlign: 'center' },
  statStack: { alignItems: 'center', alignSelf: 'stretch' },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: FONTS.uiBold, color: '#FFFFFF', fontVariant: ['tabular-nums'], textAlign: 'center' },
  statLabel: { fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, textAlign: 'center', marginBottom: 2 },
  statsFooter: { alignItems: 'center', gap: 8 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  wordmark: { fontFamily: FONTS.displayBold, color: '#FFFFFF', letterSpacing: 2 },
});
