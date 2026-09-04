import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, PALETTE, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { BookSearchResult } from '@/services/types';
import { BookCover } from '@/components/shared/BookCover';

/** Final offset (px) of the hard ink shadow on the success cover. */
const SHADOW_OFFSET = 9;

// Full-screen success celebration shown after a book lands on the shelf. Rendered
// via RN Modal so it escapes any bottom-sheet bounds and centres on the whole
// screen — big cover on a dark scrim, neubrutalist frame + check sticker.
// Auto-dismisses after ~2s; tap anywhere to continue sooner.
//
// Lives here rather than inside a screen because the add can now happen from the
// book page as well as the add-book sheet, and both owe the reader the same beat.
export function BookAddedOverlay({
  book,
  reduce,
  accent,
  onDone,
}: {
  book: BookSearchResult | null;
  reduce: boolean;
  accent: string;
  onDone: () => void;
}) {
  const doneRef = useRef(false);
  // Drives the hard offset shadow: slides from flush (0,0) to its full offset and
  // fades in once the cover has cut in — the neubrutalist "block lifts off the page".
  const shadow = useSharedValue(0);

  useEffect(() => {
    if (!book) return;
    doneRef.current = false;
    shadow.value = 0;
    shadow.value = reduce ? 1 : withDelay(120, withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }));
    const handle = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 2100);
    return () => clearTimeout(handle);
  }, [book, onDone, reduce, shadow]);

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadow.value,
    transform: [
      { translateX: SHADOW_OFFSET * shadow.value },
      { translateY: SHADOW_OFFSET * shadow.value },
    ],
  }));

  if (!book) return null;

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={overlay.root} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Continue">
        <Animated.View entering={reduce ? undefined : FadeIn.duration(140)} style={overlay.coverWrap}>
          {/* Hard ink shadow as a real block behind the cover, so it can slide in. */}
          <Animated.View style={[overlay.shadowBlock, shadowStyle]} pointerEvents="none" />
          <View style={overlay.coverFrame}>
            <BookCover url={book.coverUrl} title={book.title} width={172} />
          </View>
          <View style={[overlay.sticker, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={26} color={PALETTE.onAccent} />
          </View>
        </Animated.View>

        <Animated.View entering={reduce ? undefined : FadeIn.delay(330).duration(360)} style={overlay.textBlock}>
          <Text style={[overlay.kicker, { color: accent }]}>ADDED TO YOUR LIBRARY</Text>
          <Text style={overlay.title} numberOfLines={3}>{book.title}</Text>
          {book.authors.length > 0 ? (
            <Text style={overlay.author} numberOfLines={1}>{book.authors.join(', ')}</Text>
          ) : null}
        </Animated.View>

        <Animated.Text entering={reduce ? undefined : FadeIn.delay(700).duration(400)} style={overlay.hint}>
          Tap anywhere to continue
        </Animated.Text>
      </Pressable>
    </Modal>
  );
}

const overlay = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 24,
    backgroundColor: 'rgba(3,4,6,0.88)',
  },
  coverWrap: { alignItems: 'center', justifyContent: 'center' },
  // Sits behind the (opaque) cover frame; the animation translates it out to the
  // bottom-right so only the offset L-shape shows — a hard neubrutalist shadow.
  shadowBlock: { ...StyleSheet.absoluteFill, backgroundColor: PALETTE.ink, borderRadius: 14 },
  coverFrame: {
    borderWidth: BORDER_WIDTH_THICK, borderColor: PALETTE.ink, backgroundColor: PALETTE.paper,
    borderRadius: 14,
  },
  sticker: {
    position: 'absolute', top: -16, right: -16, width: 48, height: 48, borderRadius: 14,
    borderWidth: BORDER_WIDTH_THICK, borderColor: PALETTE.ink, alignItems: 'center', justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: 8, maxWidth: 420 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2, textAlign: 'center' },
  title: { fontFamily: FONTS.displayBold, fontSize: 26, lineHeight: 30, color: '#F6EEDF', textAlign: 'center' },
  author: { fontFamily: FONTS.uiMedium, fontSize: 15, color: 'rgba(244,241,232,0.7)', textAlign: 'center' },
  hint: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5, color: 'rgba(244,241,232,0.5)', textTransform: 'uppercase' },
});
