import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface BookProgressMarkProps {
  /** 0–1 through the book. >= 1 renders the finished (closed) book.
   *  null → a neutral wide-open book (no page data, e.g. audiobooks / re-shares). */
  progress?: number | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// The signature share mark: a hand-drawn book whose openness IS your progress.
//
// Seven coral line-art PNGs of the same book at successive stages — barely
// cracked open (1) → wide open at the middle (4) → closing again (6) → shut
// (7, finished). We pick the frame from how far this session left the reader in
// the book, so every card shows a book at the right stage without a legend.
//
// (Replaced the earlier parametric SVG, which drew correctly but read like a
// diagram — these hand-drawn frames carry the character.)
const FRAMES = [
  require('@/assets/shareable-png/book-icon-1.png'),
  require('@/assets/shareable-png/book-icon-2.png'),
  require('@/assets/shareable-png/book-icon-3.png'),
  require('@/assets/shareable-png/book-icon-4.png'),
  require('@/assets/shareable-png/book-icon-5.png'),
  require('@/assets/shareable-png/book-icon-6.png'),
];
const FINISHED = require('@/assets/shareable-png/book-icon-7.png');
const NEUTRAL = FRAMES[3]; // wide-open book for sessions with no page context

export function BookProgressMark({ progress = null, size = 96, style }: BookProgressMarkProps) {
  let source;
  if (progress == null) {
    source = NEUTRAL;
  } else if (progress >= 1) {
    source = FINISHED;
  } else {
    // Bucket 0–<1 across the six open frames (floor keeps it in range at p→1⁻).
    const i = Math.min(FRAMES.length - 1, Math.max(0, Math.floor(progress * FRAMES.length)));
    source = FRAMES[i];
  }

  // A fixed square box with the frame contained inside, so the mark keeps the same
  // footprint as it changes stage (the frames vary between portrait and landscape).
  return (
    <View style={[{ width: size, height: size }, styles.box, style]}>
      <Image source={source} style={styles.img} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
});
