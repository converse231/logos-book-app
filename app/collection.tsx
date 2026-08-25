import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { CURIOS, CURIO_KEYS, type CurioKey } from '@/components/curio/curios';
import type { OwnedCurio } from '@/services/types';

const BG = require('@/assets/curio/bg-nook.webp');
const SHELF = require('@/assets/curio/shelf-oak.webp');
const PLINTH = require('@/assets/curio/shelf-brass.webp');

// Aspect ratios of the cropped art, and where things stand on it. All measured,
// not guessed: the oak plank is drawn in slight perspective, so its top surface
// runs from the back edge down to roughly 44% before the front face begins.
const SHELF_AR = 1200 / 184;
const PLINTH_AR = 900 / 278;
/** How far a curio's base tucks behind the plank's front lip. At 0.30 the art
 *  looked embedded in the wood; 0.14 reads as standing on it. */
const STAND = 0.14;
const PLINTH_STAND = 0.1;
/** The engraved brass band, as a fraction of the plinth's height. */
const PLATE_TOP = 0.36;
const PLATE_H = 0.36;

const ROWS = [5, 4, 4];

// The forest floor — a shelf in a reading nook, not a grid of icons.
//
// Curios you have found stand in full colour; the rest are silhouettes holding
// their place. Tapping one puts it on the brass plinth with its name engraved
// on the plate, which is what that piece of art was drawn for.
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

  // Default the plinth to the newest find, so the screen opens on what you last
  // pulled out of a pouch rather than on nothing.
  const newest = useMemo(() => {
    if (!owned?.length) return null;
    return [...owned].sort((a, b) => b.firstFoundAt.localeCompare(a.firstFoundAt))[0]
      .key as CurioKey;
  }, [owned]);
  const shown = picked ?? newest;
  const shownDef = shown ? CURIOS[shown] : null;
  const shownOwned = shown ? byKey.get(shown) : undefined;
  // A curio you have not found stays a silhouette on the plinth too, and keeps
  // its name. Putting it up there in full colour with its blurb hands over the
  // whole reward for free.
  const revealed = !!shownOwned;

  const W = Math.min(width, 420);
  const shelfW = W;
  const shelfH = shelfW / SHELF_AR;
  const plinthW = W * 0.74;
  const plinthH = plinthW / PLINTH_AR;
  const curio = Math.round(W / 5.7);
  const hero = Math.round(W * 0.2);

  // Row height derived so the tallest curio always clears the shelf above it —
  // flex spacing then guarantees no overlap, which absolute offsets did not.
  const rowH = curio + shelfH * (1 - STAND);
  const stageH = hero + plinthH * (1 - PLINTH_STAND);

  return (
    <View style={styles.root}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      {/* Scrim, not a blur — house rule. The backdrop is a painting; it has to
          sit back far enough for ink text to read on top of it. */}
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
            <Ionicons name="chevron-back" size={22} color="#F7EFE0" />
          </Pressable>
          <Text style={styles.tally} allowFontScaling={false}>
            {owned == null ? '—' : `${found}/${total}`}
          </Text>
        </View>

        <Animated.View entering={reduce ? undefined : FadeIn.duration(420)} style={styles.head}>
          <Text style={styles.title}>The forest floor</Text>
          <Text style={styles.sub}>
            {found === total
              ? 'Every last one of them found.'
              : 'Small things worth stopping for.'}
          </Text>
        </Animated.View>

        {/* ── the plinth: whatever is currently being looked at ─────────── */}
        <View style={[styles.stage, { height: stageH, width: W }]}>
          {shownDef ? (
            <Animated.View
              key={shown}
              entering={reduce ? undefined : FadeInDown.duration(320)}
              style={[
                styles.heroArt,
                {
                  width: hero,
                  height: hero,
                  bottom: plinthH * (1 - PLINTH_STAND),
                  opacity: revealed ? 1 : 0.34,
                },
              ]}
            >
              <Image
                source={shownDef.art}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={0}
                tintColor={revealed ? undefined : '#231A12'}
              />
            </Animated.View>
          ) : null}

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

        {/* ── the shelves ──────────────────────────────────────────────── */}
        <View style={styles.shelves}>
          {ROWS.map((n, row) => {
            const start = ROWS.slice(0, row).reduce((a, b) => a + b, 0);
            const keys = CURIO_KEYS.slice(start, start + n);
            const slot = shelfW / n;
            return (
              <View key={row} style={{ width: shelfW, height: rowH }}>
                {keys.map((key, i) => {
                  const has = byKey.get(key);
                  const def = CURIOS[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setPicked(key)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        has
                          ? `${def.name}${has.count > 1 ? `, ${has.count} of them` : ''}`
                          : 'Not found yet'
                      }
                      hitSlop={6}
                      style={[
                        styles.slot,
                        {
                          width: slot,
                          height: curio,
                          left: slot * i,
                          bottom: shelfH * (1 - STAND),
                        },
                      ]}
                    >
                      <Image
                        source={def.art}
                        style={{ width: curio, height: curio, opacity: has ? 1 : 0.34 }}
                        contentFit="contain"
                        transition={0}
                        // A silhouette rather than a hidden slot: an outline you
                        // can see is an invitation, an empty gap is nothing.
                        tintColor={has ? undefined : '#231A12'}
                      />
                      {has && has.count > 1 ? (
                        <View style={styles.dupe}>
                          <Text style={styles.dupeText}>{`×${has.count}`}</Text>
                        </View>
                      ) : null}
                      {shown === key ? <View style={styles.pickRing} /> : null}
                    </Pressable>
                  );
                })}
                {/* Drawn after the curios so the plank's front lip overlaps
                    their bases — that tuck is what puts them ON the shelf. */}
                <Image
                  source={SHELF}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: shelfW, height: shelfH }}
                  contentFit="fill"
                  transition={0}
                  pointerEvents="none"
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const INK = '#F7EFE0';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2018' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,14,10,0.44)' },
  content: { alignItems: 'center', paddingHorizontal: 0, gap: 10 },
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
  title: {
    fontFamily: FONTS.serifBold, fontSize: 30, lineHeight: 36,
    color: INK, textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.uiRegular, fontSize: 14, color: 'rgba(247,239,224,0.72)',
    textAlign: 'center',
  },
  stage: { alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  heroArt: { position: 'absolute' },
  plinthWrap: { position: 'absolute', bottom: 0 },
  plate: { position: 'absolute', left: '9%', right: '9%', alignItems: 'center', justifyContent: 'center' },
  plateText: {
    fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 2.2,
    // Ink on brass. The plate is a bright warm gold, so dark text is the only
    // thing that reads on it.
    color: '#3A2A12', textAlign: 'center',
  },
  blurb: {
    fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 20, color: 'rgba(247,239,224,0.86)',
    textAlign: 'center', paddingHorizontal: 30, minHeight: 40, marginTop: 2,
  },
  shelves: { width: '100%', alignItems: 'center', gap: 16, marginTop: 4 },
  slot: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end' },
  dupe: {
    position: 'absolute', right: 6, bottom: -2,
    paddingHorizontal: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,14,10,0.66)',
  },
  dupeText: { fontFamily: FONTS.monoMedium, fontSize: 10, color: INK },
  pickRing: {
    position: 'absolute', left: '50%', bottom: -7, width: 22, height: 3,
    marginLeft: -11, borderRadius: 2, backgroundColor: '#F3C24C',
  },
});
