import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookCover } from './BookCover';
import { FONTS, PALETTE } from '@/theme/tokens';
import { BookFormat } from '@/services/types';

export type ReviewCardLayout = 'cover' | 'minimal';

export interface ReviewCardStats {
  rating: number;
  body: string;
  bookTitle: string;
  author: string;
  coverUrl: string | null;
  reviewerName: string;
  format?: BookFormat;
}

interface ReviewShareCanvasProps {
  mode: 'transparent' | 'dark';
  layout?: ReviewCardLayout;
  review: ReviewCardStats;
  width: number; // render width; height derived 4:5
}

// Review share card (4:5, captured at 1080×1350). Two layouts:
//   • cover   — book cover up top, then stars + the quote + attribution.
//   • minimal — no cover; the review quote is the hero, stars larger.
// Vermilion text + gold stars, all centered, with shadows so it reads over any
// background in overlay mode.
export const ReviewShareCanvas = forwardRef<View, ReviewShareCanvasProps>(
  ({ mode, layout = 'cover', review, width }, ref) => {
    const height = width * 1.25;
    const isDark = mode === 'dark';
    const withCover = layout === 'cover';

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

        <View style={[styles.inner, { gap: width * 0.045 }]}>
          {withCover ? (
            <View style={styles.coverWrap}>
              <BookCover url={review.coverUrl} title={review.bookTitle} format={review.format} width={width * 0.3} />
            </View>
          ) : null}

          <StarRow rating={review.rating} size={withCover ? width * 0.075 : width * 0.095} />

          {review.body ? (
            <Text
              style={[
                styles.quote,
                quoteShadow,
                {
                  fontSize: withCover ? width * 0.05 : width * 0.062,
                  lineHeight: withCover ? width * 0.07 : width * 0.086,
                },
              ]}
              numberOfLines={withCover ? 6 : 9}
            >
              {`“${review.body}”`}
            </Text>
          ) : null}

          <View style={styles.attribution}>
            <Text style={[styles.reviewer, textShadow, { fontSize: width * 0.044 }]} numberOfLines={1}>
              {`— ${review.reviewerName}`}
            </Text>
            <Text style={[styles.bookMeta, textShadow, { fontSize: width * 0.04 }]} numberOfLines={2}>
              {review.bookTitle}
              {review.author ? ` · ${review.author}` : ''}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);
ReviewShareCanvas.displayName = 'ReviewShareCanvas';

function StarRow({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={[styles.starRow, { gap: size * 0.14 }]} accessibilityLabel={`Rated ${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline';
        const lit = rating >= i - 0.5;
        return (
          <Ionicons
            key={i}
            name={name as keyof typeof Ionicons.glyphMap}
            size={size}
            color={lit ? PALETTE.gold : 'rgba(255,197,61,0.35)'}
            style={starShadow}
          />
        );
      })}
    </View>
  );
}

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

const quoteShadow = {
  textShadowColor: 'rgba(0,0,0,0.4)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
} as const;

const starShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 5,
} as const;

const styles = StyleSheet.create({
  card: { borderRadius: 0, overflow: 'hidden' },
  darkBg: { backgroundColor: '#141414' },
  transparentBg: { backgroundColor: 'transparent' },
  glow: {
    position: 'absolute', top: '20%', left: '15%', right: '15%', height: '50%',
    borderRadius: 0, backgroundColor: 'rgba(255,61,31,0.10)',
  },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap: {
    borderRadius: 0,
    shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  quote: { fontFamily: FONTS.uiMedium, color: '#FFFFFF', textAlign: 'center' },
  attribution: { alignItems: 'center', gap: 4 },
  reviewer: { fontFamily: FONTS.uiBold, color: '#FFFFFF', textAlign: 'center' },
  bookMeta: { fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.85)', textAlign: 'center', letterSpacing: 0.3 },
});
