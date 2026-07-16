import { useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { AiBookRec, BookSearchResult } from '@/services/types';

export interface DeckCard {
  rec: AiBookRec;
  book: BookSearchResult | null; // resolved cover/catalog match (null = unresolved)
}

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.26;
const FLING = SCREEN_W * 1.4;

// Tinder-style book deck. Swipe/▶ right = add to Want shelf, left = pass; tap (or
// the ⓘ button) opens the preview. Gesture-driven, with equivalent buttons so the
// deck is fully operable without swiping (accessibility). The parent owns the
// actual Want-shelf write via onSwipe; this component only drives the card flow.
export function SwipeDeck({
  cards,
  onSwipe,
  onTap,
  onMore,
}: {
  cards: DeckCard[];
  onSwipe: (card: DeckCard, dir: 'left' | 'right') => void;
  onTap: (card: DeckCard) => void;
  onMore: () => void;
}) {
  const t = useTheme();
  const [index, setIndex] = useState(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Blocks a second button fling while one is mid-flight, so a fast double-tap
  // can't commit the same card twice or skip the next one. Cleared when a new
  // touch begins (so grabbing a card can never wedge the deck).
  const busy = useRef(false);
  const unlock = () => { busy.current = false; };

  const commit = (dir: 'left' | 'right') => {
    const card = cards[index];
    Haptics.impactAsync(dir === 'right' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    if (card) onSwipe(card, dir);
    setIndex((i) => i + 1);
    tx.value = 0;
    ty.value = 0;
    busy.current = false;
  };

  const fling = (dir: 'left' | 'right') => {
    if (busy.current || index >= cards.length) return;
    busy.current = true;
    tx.value = withTiming(dir === 'right' ? FLING : -FLING, { duration: 230 }, (fin) => {
      if (fin) runOnJS(commit)(dir);
    });
  };

  const handleTap = () => {
    if (busy.current) return;
    const card = cards[index];
    if (card) onTap(card);
  };

  const pan = Gesture.Pan()
    .onBegin(() => { runOnJS(unlock)(); })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        tx.value = withTiming(FLING, { duration: 200 }, (fin) => { if (fin) runOnJS(commit)('right'); });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        tx.value = withTiming(-FLING, { duration: 200 }, (fin) => { if (fin) runOnJS(commit)('left'); });
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });
  const tap = Gesture.Tap().maxDistance(12).onEnd((_e, success) => { if (success) runOnJS(handleTap)(); });
  const gesture = Gesture.Race(pan, tap);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-SCREEN_W, SCREEN_W], [-9, 9], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const nextStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(tx.value, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.94, 1], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.6, 1], Extrapolation.CLAMP),
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const nopeStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP) }));

  if (index >= cards.length) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyGlyph, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
          <Ionicons name="checkmark-done" size={34} color={t.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: t.text }]}>That's the stack</Text>
        <Text style={[styles.emptyBody, { color: t.textSec }]}>
          You went through all {cards.length}. Want a fresh set?
        </Text>
        <PressBlock
          onPress={onMore}
          accessibilityLabel="Get fresh picks"
          containerStyle={styles.moreBtnWrap}
          style={[styles.moreBtn, { backgroundColor: t.accent, borderColor: t.border }]}
        >
          <Ionicons name="sparkles" size={16} color={t.onAccent} />
          <Text style={[styles.moreText, { color: t.onAccent }]}>NEW PICKS</Text>
        </PressBlock>
      </View>
    );
  }

  const top = cards[index];
  const next = cards[index + 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {next ? (
          <Animated.View style={[styles.cardAbs, nextStyle]} pointerEvents="none">
            <DeckCardView card={next} t={t} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.cardAbs, topStyle]}>
            <DeckCardView card={top} t={t} />
            <Animated.View style={[styles.badge, styles.likeBadge, likeStyle]}>
              <Text style={styles.likeText}>WANT</Text>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.nopeBadge, nopeStyle]}>
              <Text style={styles.nopeText}>PASS</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.actions}>
        <ActionBtn icon="close" label="Pass" onPress={() => fling('left')} color={t.text} bg={t.bgSec} border={t.border} />
        <ActionBtn icon="information" label="See details" onPress={handleTap} color={t.text} bg={t.bgSec} border={t.border} />
        <ActionBtn icon="heart" label="Add to Want shelf" onPress={() => fling('right')} color={t.onAccent} bg={t.accent} border={t.border} />
      </View>

      <Text style={[styles.counter, { color: t.textTer }]}>{index + 1} / {cards.length}</Text>
    </View>
  );
}

function DeckCardView({ card, t }: { card: DeckCard; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={[styles.coverFrame, { borderColor: t.border }]}>
        <BookCover url={card.book?.coverUrl ?? null} title={card.rec.title} width={150} />
      </View>
      <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>{card.rec.title}</Text>
      <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>{card.rec.author}</Text>
      <Text style={[styles.why, { color: t.textSec }]} numberOfLines={3}>{card.rec.why}</Text>
      <Text style={[styles.tapHint, { color: t.textTer }]}>TAP FOR DETAILS</Text>
    </View>
  );
}

function ActionBtn({
  icon, label, onPress, color, bg, border,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  stack: { width: SCREEN_W - 48, height: 440, alignItems: 'center', justifyContent: 'center' },
  cardAbs: { position: 'absolute', width: '100%', height: '100%' },
  card: {
    flex: 1, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, padding: 18,
    alignItems: 'center', gap: 8, ...SHADOW.card,
  },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 14, marginBottom: 6 },
  title: { fontFamily: FONTS.displayBold, fontSize: 20, lineHeight: 24, textAlign: 'center' },
  author: { fontFamily: FONTS.mono, fontSize: 12 },
  why: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 19, textAlign: 'center', marginTop: 2 },
  tapHint: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, marginTop: 'auto' },

  badge: {
    position: 'absolute', top: 22, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: BORDER_WIDTH_THICK,
  },
  likeBadge: { right: 18, borderColor: '#1F9D55', transform: [{ rotate: '12deg' }] },
  nopeBadge: { left: 18, borderColor: '#B81414', transform: [{ rotate: '-12deg' }] },
  likeText: { fontFamily: FONTS.uiBold, fontSize: 18, letterSpacing: 1, color: '#1F9D55' },
  nopeText: { fontFamily: FONTS.uiBold, fontSize: 18, letterSpacing: 1, color: '#B81414' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn: { width: 58, height: 58, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  counter: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  emptyGlyph: { width: 72, height: 72, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONTS.displayBold, fontSize: 24, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  moreBtnWrap: { marginTop: 6 },
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 20, height: 50, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK,
  },
  moreText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1 },
});
