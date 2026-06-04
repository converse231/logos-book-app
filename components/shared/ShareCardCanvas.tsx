import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookCover } from './BookCover';
import { LevelNameBadge } from './LevelNameBadge';
import { FONTS } from '@/theme/tokens';
import { BookFormat, CardVariant } from '@/services/types';

export interface CardStats {
  headline: string; // big number/text
  headlineUnit: string; // "pages" | "minutes" | "day streak"
  sub: { label: string; value: string }[];
  bookTitle?: string;
  bookCoverUrl?: string | null;
  format?: BookFormat;
}

interface ShareCardCanvasProps {
  variant: CardVariant;
  mode: 'transparent' | 'dark';
  stats: CardStats;
  levelName: string;
  width: number; // render width; height derived 4:5
}

// The view-shot target (blueprint #28/10). 4:5 portrait. Text carries a shadow
// so it stays legible over any background in transparent mode. The capture step
// (react-native-view-shot at 1080×1350) lands with the dev build; this renders
// the design at any preview width.
export const ShareCardCanvas = forwardRef<View, ShareCardCanvasProps>(
  ({ variant, mode, stats, levelName, width }, ref) => {
    const height = width * 1.25; // 4:5
    const isDark = mode === 'dark';

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          { width, height, padding: width * 0.07 },
          isDark ? styles.darkBg : styles.transparentBg,
        ]}
      >
        {isDark ? <View style={styles.glow} pointerEvents="none" /> : null}

        {/* Top: title on the left, cover on the right. The cover now renders in
            both modes — including the overlay PNG — so the shared image always
            carries the book it came from. */}
        <View style={styles.top}>
          {stats.bookTitle ? (
            <Text style={[styles.bookTitle, textShadow]} numberOfLines={2}>
              {stats.bookTitle}
            </Text>
          ) : null}
          {stats.bookTitle ? (
            <View style={styles.coverWrap}>
              <BookCover
                url={stats.bookCoverUrl}
                title={stats.bookTitle}
                format={stats.format}
                width={width * 0.2}
              />
            </View>
          ) : null}
        </View>

        {/* Headline stat */}
        <View style={styles.headlineBlock}>
          <Text style={[styles.headline, headlineShadow, { fontSize: width * 0.26 }]}>
            {stats.headline}
          </Text>
          <Text style={[styles.headlineUnit, textShadow, { fontSize: width * 0.05 }]}>
            {stats.headlineUnit}
          </Text>
        </View>

        {/* Sub-stats */}
        <View style={styles.subRow}>
          {stats.sub.map((s, i) => (
            <View key={i} style={styles.subItem}>
              <Text style={[styles.subValue, textShadow, { fontSize: width * 0.058 }]}>{s.value}</Text>
              <Text style={[styles.subLabel, textShadow, { fontSize: width * 0.034 }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer: level badge + wordmark */}
        <View style={styles.footer}>
          <LevelNameBadge levelName={levelName} context="share_card" mode={mode} size="sm" />
          <Text style={[styles.wordmark, textShadow, { fontSize: width * 0.05 }]}>LOGOS</Text>
        </View>
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
  card: { borderRadius: 28, justifyContent: 'space-between', overflow: 'hidden' },
  darkBg: { backgroundColor: '#0E0F14' },
  transparentBg: { backgroundColor: 'transparent' },
  glow: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    right: '15%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: 'rgba(61,123,255,0.10)',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  bookTitle: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14, color: '#FFFFFF' },
  coverWrap: {
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  headlineBlock: { alignItems: 'flex-start' },
  headline: { fontFamily: FONTS.uiBold, color: '#FFFFFF', fontVariant: ['tabular-nums'], lineHeight: undefined },
  headlineUnit: { fontFamily: FONTS.uiMedium, color: '#FFFFFF', marginTop: -4 },
  subRow: { flexDirection: 'row', gap: 24 },
  subItem: { gap: 2 },
  subValue: { fontFamily: FONTS.uiBold, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  subLabel: { fontFamily: FONTS.uiMedium, color: 'rgba(255,255,255,0.75)' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: FONTS.displayBold, color: '#FFFFFF', letterSpacing: 2 },
});
