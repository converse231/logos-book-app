import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { UserBook } from '@/services/types';
import { BookCover } from '@/components/shared/BookCover';

const COVER_W = 152;
const COVER_H = COVER_W / 0.66;
const ITEM_W = 116; // snap interval < cover width → covers overlap, coverflow style

interface ReadingCarouselProps {
  books: UserBook[];
  initialIndex: number;
  /** Fires on settle. `index === books.length` means the trailing "add" tile. */
  onSelect: (index: number) => void;
  onAddPress: () => void;
}

// Coverflow picker for the "currently reading" shelf. Center cover is full-size
// and on top; neighbors shrink, dim, drop, and tuck behind it. Snaps one book
// at a time; a trailing tile adds a book to the current reads.
export function ReadingCarousel({ books, initialIndex, onSelect, onAddPress }: ReadingCarouselProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const side = (width - ITEM_W) / 2;
  const scrollX = useSharedValue(initialIndex * ITEM_W);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const count = books.length + 1;

  // Center the initial book (it may not be index 0) once mounted.
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * ITEM_W, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [initialIndex]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const settle = (x: number) => {
    const idx = Math.max(0, Math.min(count - 1, Math.round(x / ITEM_W)));
    onSelect(idx);
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={ITEM_W}
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
      contentOffset={{ x: initialIndex * ITEM_W, y: 0 }}
      contentContainerStyle={[styles.content, { paddingHorizontal: side }]}
      style={styles.scroll}
    >
      {books.map((b, i) => (
        <CarouselItem key={b.id} index={i} scrollX={scrollX}>
          <BookCover url={b.book.coverUrl} title={b.book.title} format={b.format} showFormatBadge width={COVER_W} />
        </CarouselItem>
      ))}
      <CarouselItem key="__add" index={books.length} scrollX={scrollX}>
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="Add a book to your current reads"
          style={[styles.addTile, { borderColor: t.accent, backgroundColor: t.bgSec }]}
        >
          <Ionicons name="add" size={36} color={t.accent} />
          <Text style={[styles.addText, { color: t.text }]}>ADD A BOOK</Text>
        </Pressable>
      </CarouselItem>
    </Animated.ScrollView>
  );
}

function CarouselItem({
  index,
  scrollX,
  children,
}: {
  index: number;
  scrollX: { value: number };
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const d = scrollX.value / ITEM_W - index; // 0 at center
    const scale = interpolate(d, [-1, 0, 1], [0.78, 1, 0.78], Extrapolation.CLAMP);
    const opacity = interpolate(d, [-1.4, 0, 1.4], [0.4, 1, 0.4], Extrapolation.CLAMP);
    const translateY = interpolate(Math.abs(d), [0, 1], [0, 16], Extrapolation.CLAMP);
    const zIndex = Math.round(interpolate(Math.abs(d), [0, 1, 2], [100, 50, 10], Extrapolation.CLAMP));
    return { transform: [{ scale }, { translateY }], opacity, zIndex };
  });

  return <Animated.View style={[styles.item, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  scroll: { height: COVER_H + 28, flexGrow: 0 },
  content: { alignItems: 'center' },
  item: { width: ITEM_W, alignItems: 'center', justifyContent: 'center' },
  addTile: {
    width: COVER_W,
    height: COVER_H,
    borderRadius: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: { fontFamily: FONTS.uiBold, fontSize: 13, letterSpacing: 0.5 },
});
