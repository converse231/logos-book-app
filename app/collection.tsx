import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { CURIOS, CURIO_KEYS, type CurioDef, type CurioKey } from '@/components/curio/curios';
import type { OwnedCurio } from '@/services/types';

const BG = require('@/assets/curio/bg-nook.webp');
const SHELF = require('@/assets/curio/shelf-oak.webp');
const PLINTH = require('@/assets/curio/shelf-brass.webp');

// Aspect ratios of the cropped art, and where things stand on it — measured off
// the files, not guessed.
const SHELF_AR = 1200 / 184;
const PLINTH_AR = 900 / 278;
// The plank is drawn in perspective: its visible top surface runs from the back
// edge to roughly 0.44 of its height. Objects stand at 0.26, ON that surface,
// and are drawn AFTER the shelf so nothing clips them. Contact is sold with a
// shadow rather than by hiding their feet behind the wood.
const BASE = 0.26;
const PLINTH_BASE = 0.2;
/** The engraved brass band, as a fraction of the plinth's height. */
const PLATE_TOP = 0.36;
const PLATE_H = 0.36;
/** 13 curios. Widest row first, so the shelves taper as a real one fills. */
const ROWS = [5, 4, 4];

// The forest floor — a shelf in a reading nook.
//
// Curios you have found stand in full colour; the rest are silhouettes holding
// their place, and stay silhouettes on the plinth too. Tapping one lifts it and
// puts its name on the brass plate, which is what that art was drawn for.
export default function CollectionScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const [owned, setOwned] = useState<OwnedCurio[] | null>(null);
  const [picked, setPicked] = useState<CurioKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getCurios()
        .then((c) => alive && setOwned(c))
        .catch(() => alive && setOwned([]));
      return () => {
        alive = false;
      };
    }, [api])
  );

  const byKey = useMemo(() => {
    const m = new Map<string, OwnedCurio>();
    for (const c of owned ?? []) m.set(c.key, c);
    return m;
  }, [owned]);

  const found = byKey.size;
  const total = CURIO_KEYS.length;

  // Open on the newest find rather than on nothing.
  const newest = useMemo(() => {
    if (!owned?.length) return null;
    return [...owned].sort((a, b) => b.firstFoundAt.localeCompare(a.firstFoundAt))[0]
      .key as CurioKey;
  }, [owned]);
  const shown = picked ?? newest;
  const shownDef = shown ? CURIOS[shown] : null;
  const shownOwned = shown ? byKey.get(shown) : undefined;
  // A curio you have not found stays a silhouette up here too, and keeps its
  // name. Showing it in full with its blurb hands over the reward for free.
  const revealed = !!shownOwned;

  const W = Math.min(width, 420);
  const shelfH = W / SHELF_AR;
  const plinthW = W * 0.72;
  const plinthH = plinthW / PLINTH_AR;
  const item = Math.round(W / 6.1);
  const hero = Math.round(W * 0.215);

  // Heights derived from the art, so rows can never collide however the numbers
  // above are retuned.
  const rowH = item + shelfH * (1 - BASE);
  const stageH = hero + plinthH * (1 - PLINTH_BASE);

  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    bob.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [reduce, bob]);
  const heroFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 3 }] }));

  return (
    <View style={styles.root}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      {/* Scrim, not a blur — house rule. The backdrop is a painting and has to
          sit back far enough for text to read on top of it. */}
      <View style={styles.scrim} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.roundBtn}
          >
            <Ionicons name="chevron-back" size={22} color={INK} />
          </Pressable>
          <Text style={styles.tally} allowFontScaling={false}>
            {owned == null ? '—' : `${found}/${total}`}
          </Text>
        </View>

        <Animated.View entering={reduce ? undefined : FadeIn.duration(420)} style={styles.head}>
          <Text style={styles.title}>The forest floor</Text>
          <Text style={styles.sub}>
            {found === total ? 'Every last one of them found.' : 'Small things worth stopping for.'}
          </Text>
        </Animated.View>

        {/* ── the plinth ─────────────────────────────────────────────────── */}
        <View style={[styles.stage, { height: stageH, width: W }]}>
          <View style={[styles.plinthWrap, { width: plinthW, height: plinthH }]}>
            <Image source={PLINTH} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
            <View
              style={[styles.plate, { top: plinthH * PLATE_TOP, height: plinthH * PLATE_H }]}
              pointerEvents="none"
            >
              <Text style={styles.plateText} numberOfLines={1} adjustsFontSizeToFit>
                {!shownDef ? 'NOTHING FOUND YET' : revealed ? shownDef.name.toUpperCase() : '? ? ?'}
              </Text>
            </View>
          </View>

          {/* After the plinth, so it stands on top of it. */}
          {shownDef ? (
            <Animated.View
              key={shown}
              entering={reduce ? undefined : FadeInDown.duration(340)}
              style={[
                styles.heroSlot,
                { bottom: plinthH * (1 - PLINTH_BASE), width: hero, height: hero },
              ]}
            >
              <View
                style={[
                  styles.shadow,
                  { width: hero * 0.5, height: hero * 0.15, bottom: -hero * 0.075 },
                ]}
              />
              <Animated.View
                style={[StyleSheet.absoluteFill, heroFloat, { opacity: revealed ? 1 : 0.34 }]}
              >
                <Image
                  source={shownDef.art}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  transition={0}
                  tintColor={revealed ? undefined : LOCKED}
                />
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>

        <Text style={styles.blurb}>
          {!shownDef
            ? 'Open a pouch and something will turn up.'
            : !revealed
            ? 'Still out there somewhere.'
            : shownOwned && shownOwned.count > 1
            ? `${shownDef.blurb}  ·  ${shownOwned.count} of them`
            : shownDef.blurb}
        </Text>

        {/* ── the shelves ────────────────────────────────────────────────── */}
        <View style={styles.shelves}>
          {ROWS.map((n, row) => {
            const start = ROWS.slice(0, row).reduce((a, b) => a + b, 0);
            const keys = CURIO_KEYS.slice(start, start + n);
            const slot = W / n;
            return (
              <View key={row} style={{ width: W, height: rowH }}>
                {/* Shelf first; the curios go on top of it. */}
                <Image
                  source={SHELF}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: W, height: shelfH }}
                  contentFit="fill"
                  transition={0}
                  pointerEvents="none"
                />
                {keys.map((key, i) => (
                  <ShelfItem
                    key={key}
                    def={CURIOS[key]}
                    owned={byKey.get(key)}
                    selected={shown === key}
                    size={item}
                    left={slot * i}
                    slot={slot}
                    bottom={shelfH * (1 - BASE)}
                    delay={(start + i) * 45}
                    reduce={reduce}
                    onPress={() => setPicked(key)}
                  />
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * One curio standing on a shelf.
 *
 * Selecting it lifts it and shrinks its contact shadow. The shadow moving is
 * what reads as "picked up" — the translate on its own just looks like a nudge.
 */
function ShelfItem({
  def, owned, selected, size, left, slot, bottom, delay, reduce, onPress,
}: {
  def: CurioDef;
  owned?: OwnedCurio;
  selected: boolean;
  size: number;
  left: number;
  slot: number;
  bottom: number;
  delay: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = reduce
      ? selected
        ? 1
        : 0
      : withSpring(selected ? 1 : 0, { damping: 13, stiffness: 190, mass: 0.6 });
  }, [selected, reduce, lift]);

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 7 }, { scale: 1 + lift.value * 0.09 }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: (owned ? 0.42 : 0.24) - lift.value * 0.14,
    transform: [{ scaleX: 1 - lift.value * 0.18 }],
  }));

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.delay(delay).duration(380)}
      style={{ position: 'absolute', left, bottom, width: slot, height: size }}
    >
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          owned
            ? `${def.name}${owned.count > 1 ? `, ${owned.count} of them` : ''}`
            : 'Not found yet'
        }
        style={styles.itemPress}
      >
        <Animated.View
          style={[
            styles.shadow,
            { width: size * 0.56, height: size * 0.17, bottom: -size * 0.085 },
            shadowStyle,
          ]}
        />
        <Animated.View style={[{ width: size, height: size }, artStyle]}>
          <Image
            source={def.art}
            style={[StyleSheet.absoluteFill, { opacity: owned ? 1 : 0.34 }]}
            contentFit="contain"
            transition={0}
            // A silhouette rather than an empty slot: an outline you can see is
            // an invitation, a gap is nothing.
            tintColor={owned ? undefined : LOCKED}
          />
        </Animated.View>
        {owned && owned.count > 1 ? (
          <View style={styles.dupe}>
            <Text style={styles.dupeText}>{`×${owned.count}`}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const INK = '#F7EFE0';
const LOCKED = '#231A12';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2018' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,14,10,0.44)' },
  content: { alignItems: 'center', gap: 10 },
  topBar: {
    width: '100%', paddingHorizontal: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  roundBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(247,239,224,0.34)', backgroundColor: 'rgba(20,14,10,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  tally: {
    fontFamily: FONTS.monoBold, fontSize: 15, color: INK,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  head: { alignItems: 'center', gap: 2, marginTop: 2, paddingHorizontal: 18 },
  title: { fontFamily: FONTS.serifBold, fontSize: 30, lineHeight: 36, color: INK, textAlign: 'center' },
  sub: { fontFamily: FONTS.uiRegular, fontSize: 14, color: 'rgba(247,239,224,0.72)', textAlign: 'center' },
  stage: { alignItems: 'center', justifyContent: 'flex-end', marginTop: 6 },
  plinthWrap: { position: 'absolute', bottom: 0 },
  heroSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end' },
  plate: { position: 'absolute', left: '9%', right: '9%', alignItems: 'center', justifyContent: 'center' },
  plateText: {
    // Ink on brass — the plate is bright warm gold, so only dark text reads.
    fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2.2,
    color: '#3A2A12', textAlign: 'center',
  },
  blurb: {
    fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 20,
    color: 'rgba(247,239,224,0.86)', textAlign: 'center',
    paddingHorizontal: 30, minHeight: 40, marginTop: 4,
  },
  shelves: { width: '100%', alignItems: 'center', gap: 18, marginTop: 2 },
  itemPress: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  // An ellipse via borderRadius. RN cannot draw a soft radial falloff on a View,
  // so this is a flat ellipse kept small and low-opacity — at this size it reads
  // as contact, not as a black blob.
  shadow: { position: 'absolute', borderRadius: 999, backgroundColor: '#160E06' },
  dupe: {
    position: 'absolute', right: 2, bottom: -4,
    paddingHorizontal: 5, borderRadius: 8, backgroundColor: 'rgba(20,14,10,0.72)',
  },
  dupeText: { fontFamily: FONTS.monoMedium, fontSize: 10, color: INK },
});
