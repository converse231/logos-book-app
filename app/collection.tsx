import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { PressBlock } from '@/components/shared/PressBlock';
import { PouchReveal } from '@/components/curio/PouchReveal';
import { markFirefliesSeen } from '@/lib/jarSeen';
import {
  CURIOS,
  CURIO_KEYS,
  POUCH_COST,
  SETS,
  TIER_LOOK,
  curioTier,
  setOf,
  type CurioDef,
  type CurioKey,
  type CurioSet,
} from '@/components/curio/curios';
import type { CurioSetId, OwnedCurio, PouchResult } from '@/services/types';

const SHELF = require('@/assets/curio/shelf-oak.webp');
const PLINTH = require('@/assets/curio/shelf-brass.webp');
const GLOW = require('@/assets/jar/glow.webp');

// Aspect ratios of the cropped art, and where things stand on it — measured off
// the files, not guessed.
const SHELF_AR = 1200 / 184;
const PLINTH_AR = 900 / 278;
// The plank is drawn in perspective: its visible top surface runs from the back
// edge to roughly 0.44 of its height. Objects stand at 0.26, ON that surface,
// and are drawn AFTER the shelf so nothing clips them.
const BASE = 0.26;
const PLINTH_BASE = 0.2;
/** The engraved brass band, as a fraction of the plinth's height. */
const PLATE_TOP = 0.36;
const PLATE_H = 0.36;

/**
 * Three shelves, widest first, so they taper as a real one fills.
 *
 * Derived rather than hardcoded because the two sets are different sizes — 13
 * gives [5,4,4] (exactly what this was before) and 11 gives [4,4,3]. A constant
 * would silently drop the overflow of any set that is not thirteen.
 */
function rowsFor(n: number) {
  const base = Math.floor(n / 3);
  const r = n % 3;
  return [base + (r > 0 ? 1 : 0), base + (r > 1 ? 1 : 0), base];
}

// The collections — one horizontal page per set, swiped between.
//
// Curios you have found stand in full colour; the rest are silhouettes holding
// their place, and stay silhouettes on the plinth too. Tapping one lifts it and
// puts its name on the brass plate, which is what that art was drawn for.
//
// Paging rather than tabs because a collection is a PLACE: the backdrop, the
// shelf and the objects all change together, so the gesture that moves you
// should move the whole room. The backdrops cross-fade against the drag offset
// rather than on release, so the two rooms are continuous under your thumb.
export default function CollectionScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();
  // The PAGE is the device, not the reading column — pages must be full-bleed or
  // paging snaps to the wrong offset on a tablet.
  const pageW = useWindowDimensions().width;

  // Arriving from a pouch: open on what it produced, on ITS shelf. `newest` falls
  // back to the most recently first-found, which is wrong after a duplicate — the
  // copy you just pulled has an old first_found_at, so it would never surface.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const focused =
    focus && (CURIO_KEYS as readonly string[]).includes(focus) ? (focus as CurioKey) : null;
  const initialIndex = focused ? Math.max(0, SETS.findIndex((s) => s.id === setOf(focused))) : 0;

  const [owned, setOwned] = useState<OwnedCurio[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<PouchResult | null>(null);
  const [index, setIndex] = useState(initialIndex);
  // One selection per shelf, so swiping away and back keeps what you were
  // looking at instead of resetting the other room.
  const [picked, setPicked] = useState<Partial<Record<CurioSetId, CurioKey>>>(
    focused ? { [setOf(focused)]: focused } : {}
  );

  const set = SETS[index];
  const pager = useRef<Animated.ScrollView>(null);
  const pages = useRef<Record<string, ScrollView | null>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getCurios()
        .then((c) => alive && setOwned(c))
        .catch(() => alive && setOwned([]));
      // The balance lives here too now: this is where it gets spent, so the CTA
      // has to know what it can afford without a round trip through the jar.
      api.getProfile()
        .then((p) => alive && setBalance(p.fireflies ?? 0))
        .catch(() => alive && setBalance(0));
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

  const found = useMemo(
    () => set.keys.reduce((n, k) => n + (byKey.has(k) ? 1 : 0), 0),
    [set, byKey]
  );

  const shortfall = balance == null ? POUCH_COST : Math.max(0, POUCH_COST - balance);
  const affordable = balance != null && balance >= POUCH_COST;

  // Shelf geometry stays on the reading column even though pages are full-bleed.
  const W = Math.min(width, 420);

  /** Drag offset in pages. Drives the backdrops and the dots off the same value,
   *  so both track the thumb instead of snapping when the page settles. */
  const x = useSharedValue(initialIndex);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x / Math.max(1, pageW);
  });

  // Landing on set two from a pouch deep-link. contentOffset as a prop is
  // iOS-only, so the jump is done once on mount, unanimated.
  useEffect(() => {
    if (initialIndex > 0) pager.current?.scrollTo({ x: initialIndex * pageW, animated: false });
    // Mount only — re-running this on a width change would yank the reader
    // back to where they started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    bob.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [reduce, bob]);

  // open_pouch is deliberately NOT idempotent, so a double tap buys two pouches
  // — 80 fireflies. `opening` alone cannot prevent that: setState is async, so
  // two taps in the same frame both read it as false and both get through. The
  // ref flips synchronously and is the real guard; the state exists only to
  // drive the label and the disabled style.
  const inFlight = useRef(false);
  const openPouch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    try {
      const r = await api.openPouch(set.id);
      if (r.ok) {
        setBalance(r.fireflies);
        // Without this, spending leaves `seen` above the balance and Home's
        // badge stays dark through the next few sessions' earnings.
        markFirefliesSeen(r.fireflies);
        // Fold the result in rather than refetching, and select it: the reveal
        // closes onto the curio standing on the plinth, on the shelf it came
        // from, with that page's count already ticked up.
        setOwned((prev) => {
          const list = prev ?? [];
          return list.some((c) => c.key === r.key)
            ? list.map((c) => (c.key === r.key ? { ...c, count: r.count } : c))
            : [...list, { key: r.key, count: r.count, firstFoundAt: new Date().toISOString() }];
        });
        setPicked((p) => ({ ...p, [setOf(r.key)]: r.key as CurioKey }));
      }
      setReveal(r);
    } catch {
      // Never report a network failure as "not enough fireflies" — nothing was
      // spent, and the balance on screen is still correct.
      setReveal({ ok: false, reason: 'error', cost: POUCH_COST });
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  }, [api, set.id]);

  return (
    <View style={styles.root}>
      {SETS.map((s, i) => (
        <Backdrop key={s.id} art={s.bg} scrim={s.scrim} index={i} x={x} />
      ))}

      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW));
          if (next !== index) {
            Haptics.selectionAsync();
            setIndex(next);
          }
        }}
        style={StyleSheet.absoluteFill}
      >
        {SETS.map((s) => (
          <SetPage
            key={s.id}
            set={s}
            width={W}
            pageW={pageW}
            byKey={byKey}
            picked={picked[s.id] ?? null}
            onPick={(k) => setPicked((p) => ({ ...p, [s.id]: k }))}
            owned={owned}
            reduce={reduce}
            bob={bob}
            insets={{ top: insets.top, bottom: insets.bottom }}
            scrollRef={(r) => {
              pages.current[s.id] = r;
            }}
          />
        ))}
      </Animated.ScrollView>

      {/* Fixed chrome. Dots live IN the top bar, so the affordance costs no
          vertical space at all — the alternative was a row of its own between
          the title and the plinth, which is exactly the space this screen has
          least of. */}
      <View style={[styles.topBar, { top: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.roundBtn,
            { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </Pressable>

        <View style={styles.dots} accessibilityRole="tablist">
          {SETS.map((s, i) => (
            <Dot
              key={s.id}
              index={i}
              x={x}
              label={s.name}
              selected={i === index}
              onPress={() => {
                if (i === index) return;
                Haptics.selectionAsync();
                setIndex(i);
                pager.current?.scrollTo({ x: i * pageW, animated: true });
              }}
            />
          ))}
        </View>

        <Text
          style={styles.tally}
          allowFontScaling={false}
          accessibilityRole="text"
          accessibilityLabel={
            owned == null
              ? 'Loading your collection'
              : `${found} of ${set.keys.length} found in ${set.name}`
          }
        >
          {owned == null ? '—' : `${found}/${set.keys.length}`}
        </Text>
      </View>

      {/* Pinned, because it is the point of the screen and the shelves scroll.
          A darkened ledge rather than a blur — house rule — so the button never
          has to compete with a curio passing behind it. */}
      <Animated.View
        entering={reduce ? undefined : FadeInUp.delay(240).duration(420)}
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        <PressBlock
          onPress={openPouch}
          disabled={!affordable || opening}
          emphasis="primary"
          haptic="medium"
          radius={16}
          style={[
            styles.cta,
            {
              backgroundColor: affordable ? '#F0764F' : 'rgba(247,239,224,0.1)',
              borderColor: affordable ? INK_BORDER : 'rgba(247,239,224,0.26)',
            },
          ]}
          accessibilityLabel={
            affordable
              ? `Open a pouch for ${POUCH_COST} fireflies, from ${set.name}`
              : `${shortfall} more fireflies needed for a pouch. Read to earn them.`
          }
          accessibilityState={{ disabled: !affordable || opening, busy: opening }}
        >
          <Text
            style={[styles.ctaText, { color: affordable ? '#241E19' : 'rgba(247,239,224,0.72)' }]}
            allowFontScaling={false}
          >
            {opening
              ? 'OPENING…'
              : affordable
              ? `OPEN A POUCH · ${POUCH_COST}`
              : `${shortfall} MORE FIREFLIES`}
          </Text>
        </PressBlock>
        <Text style={styles.footerNote}>
          {balance == null
            ? ' '
            : affordable
            ? `${balance} in your jar`
            : 'Every session you read puts fireflies in the jar.'}
        </Text>
      </Animated.View>

      {reveal ? (
        <PouchReveal
          result={reveal}
          onDone={() => {
            setReveal(null);
            // The button is at the bottom and the payoff is on the plinth at the
            // top — glide up to it rather than dropping the reader back onto the
            // shelf they were staring at.
            if (reveal.ok) pages.current[set.id]?.scrollTo({ y: 0, animated: true });
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * One collection: its title, its plinth, its shelves.
 *
 * Both pages stay mounted — 24 Images against a gesture that has to show two
 * rooms at once mid-drag. Unmounting the off-screen page would make every swipe
 * pop its art in on arrival.
 */
function SetPage({
  set, width, pageW, byKey, owned, picked, onPick, reduce, bob, insets, scrollRef,
}: {
  set: CurioSet;
  width: number;
  pageW: number;
  byKey: Map<string, OwnedCurio>;
  owned: OwnedCurio[] | null;
  picked: CurioKey | null;
  onPick: (k: CurioKey) => void;
  reduce: boolean;
  bob: SharedValue<number>;
  insets: { top: number; bottom: number };
  scrollRef: (r: ScrollView | null) => void;
}) {
  const W = width;
  const shelfH = W / SHELF_AR;
  const plinthW = W * 0.72;
  const plinthH = plinthW / PLINTH_AR;
  const item = Math.round(W / 6.1);
  const hero = Math.round(W * 0.215);

  // Heights derived from the art, so rows can never collide however the numbers
  // above are retuned.
  const rowH = item + shelfH * (1 - BASE);
  const stageH = hero + plinthH * (1 - PLINTH_BASE);

  const found = set.keys.reduce((n, k) => n + (byKey.has(k) ? 1 : 0), 0);
  const total = set.keys.length;
  const rows = rowsFor(total);

  // Open on the newest find in this set rather than on nothing.
  const newest = useMemo(() => {
    const mine = (owned ?? []).filter((c) => setOf(c.key) === set.id);
    if (!mine.length) return null;
    return mine.sort((a, b) => b.firstFoundAt.localeCompare(a.firstFoundAt))[0].key as CurioKey;
  }, [owned, set.id]);

  // Falling back to the set's first key means an untouched collection shows a
  // teasing silhouette, not a hole.
  const shown = picked ?? newest ?? set.keys[0];
  const shownDef: CurioDef | null = shown ? CURIOS[shown] : null;
  const shownOwned = shown ? byKey.get(shown) : undefined;
  // A curio you have not found stays a silhouette up here too, and keeps its
  // name. Showing it in full with its blurb hands over the reward for free.
  const revealed = !!shownOwned;

  const heroFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 3 }] }));

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width: pageW }}
      contentContainerStyle={[
        styles.content,
        // Clears the fixed top bar and the pinned footer, so neither the title
        // nor the bottom shelf is ever trapped under one.
        { paddingTop: insets.top + TOPBAR_H, paddingBottom: insets.bottom + FOOTER_H },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={reduce ? undefined : FadeIn.duration(420)} style={styles.head}>
        <Text style={styles.title}>{set.name}</Text>
        <Text style={styles.sub}>{found === total ? set.done : set.sub}</Text>
      </Animated.View>

      {/* ── the plinth ───────────────────────────────────────────────────── */}
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
            <Animated.View
              style={[StyleSheet.absoluteFill, heroFloat, { opacity: revealed ? 1 : 0.5 }]}
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

      {/* Attached under the plinth, because that is what it describes — a
          specimen label's condition line. Floating the seal in the gutter and
          dropping the copies into a bare sentence made two orphans out of one
          fact. Reserved height either way, so nothing below it moves. */}
      {revealed && shownOwned ? <TierStrip count={shownOwned.count} /> : <View style={styles.stripGap} />}

      <Text style={styles.blurb}>
        {!shownDef
          ? 'Open a pouch and something will turn up.'
          : revealed
          ? shownDef.blurb
          : found === 0
          ? 'Open a pouch and something will turn up.'
          : 'Still out there somewhere.'}
      </Text>

      {/* ── the shelves ──────────────────────────────────────────────────── */}
      <View style={styles.shelves}>
        {rows.map((n, row) => {
          const start = rows.slice(0, row).reduce((a, b) => a + b, 0);
          const keys = set.keys.slice(start, start + n);
          const slot = W / n;
          return (
            <View key={`${set.id}-${row}`} style={{ width: W, height: rowH }}>
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
                  onPress={() => onPick(key)}
                />
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * One collection's painting, cross-fading with the others.
 *
 * Every set's backdrop stays mounted, and opacity is driven by the pager's drag
 * offset rather than by a boolean on release — so the two rooms blend under your
 * thumb and a half-swipe shows half of each. Swapping the source on one Image
 * would pop, and expo-image's own `transition` cannot cross-fade between two
 * different sources mid-flight.
 */
function Backdrop({
  art,
  scrim,
  index,
  x,
}: {
  art: number;
  scrim: number;
  index: number;
  x: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    // The bottom layer never fades: two translucent paintings stacked over the
    // root colour do not blend 50/50 mid-drag — the lower one is seen through
    // BOTH the upper one and the root, so the halfway point sags dark. Holding
    // the base opaque makes the drag a true cross-fade.
    // ponytail: correct for two collections. A third would need each layer to
    // fade only against its immediate neighbour, or one Image whose source
    // swaps at the midpoint.
    opacity: index === 0 ? 1 : Math.max(0, 1 - Math.abs(x.value - index)),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      {/* Each painting carries its OWN scrim rather than one shared layer on top,
          which is what lets two sets at different values cross-fade correctly:
          the fade blends two finished looks instead of sliding one painting under
          a scrim tuned for the other. A darkened translucent scrim, never a blur
          — house rule. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(20,14,10,${scrim})` }]} />
    </Animated.View>
  );
}

/** Where you are, and a tap target for getting to the other room. Stretches
 *  toward the page you are dragging to, so it reads as travel and not as a
 *  radio button. */
function Dot({
  index,
  x,
  label,
  selected,
  onPress,
}: {
  index: number;
  x: SharedValue<number>;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(x.value - index));
    return {
      width: 7 + near * 15,
      opacity: 0.4 + near * 0.6,
    };
  });
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.dot, style]} />
    </Pressable>
  );
}

/**
 * The specimen's condition: its seal, its grade, and how far to the next one.
 *
 * One bordered strip rather than a badge here and a sentence there — copies are
 * a single fact and they read as noise when split across the layout. This is
 * also what stops a finished collection reading as finished.
 */
function TierStrip({ count }: { count: number }) {
  const t = curioTier(count);
  if (t.index < 0) return <View style={styles.stripGap} />;
  const top = t.toNext === null;
  // Progress WITHIN this tier: copies since it began, over the span to the next.
  const span = top ? 1 : count + t.toNext! - t.at;
  const fill = top ? 1 : (count - t.at) / span;

  return (
    <View style={styles.strip} accessible accessibilityLabel={
      top
        ? `${t.name}, ${count} copies, fully polished`
        : `${t.name}, ${count} of ${count + t.toNext!} copies toward ${t.nextName}`
    }>
      <Image source={t.art!} style={styles.stripSeal} contentFit="contain" transition={0} />
      <Text style={[styles.stripName, top && styles.stripNameTop]} allowFontScaling={false}>
        {(t.name ?? '').toUpperCase()}
      </Text>
      {top ? (
        <Text style={styles.stripCount} allowFontScaling={false}>
          {`${count} COPIES`}
        </Text>
      ) : (
        <>
          <View style={styles.stripTrack}>
            <View style={[styles.stripFill, { width: `${Math.round(fill * 100)}%` }]} />
          </View>
          <Text style={styles.stripCount} allowFontScaling={false}>
            {`${count}/${count + t.toNext!}`}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * One curio standing on a shelf.
 *
 * Selecting it springs it up and scales it slightly. Contact with the shelf is
 * carried by placement alone — objects stand on the plank's visible top surface
 * (BASE), with no drawn shadow.
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
  const tier = owned ? curioTier(owned.count).index : -1;

  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = reduce
      ? selected
        ? 1
        : 0
      : withSpring(selected ? 1 : 0, { damping: 13, stiffness: 190, mass: 0.6 });
  }, [selected, reduce, lift]);

  // Pressing dips the curio immediately; the selection spring then lifts it.
  // Without the dip the only feedback is a spring that starts ~1 frame later,
  // which reads as lag rather than as a press.
  const press = useSharedValue(0);
  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * 7 + press.value * 3 },
      { scale: (1 + lift.value * 0.09) * (1 - press.value * 0.07) },
    ],
  }));

  // Luminous curios breathe. Only the top tier runs a repeating animation, so a
  // shelf of ordinary finds costs nothing extra.
  const pulse = useSharedValue(0);
  const look = TIER_LOOK[Math.max(0, tier)];
  useEffect(() => {
    if (reduce || !look.pulse) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [reduce, look.pulse, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: look.glow * (look.pulse ? 0.7 + pulse.value * 0.5 : 1) + lift.value * 0.12,
    transform: [{ scale: look.scale * (1 + lift.value * 0.08) }],
  }));

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.delay(delay).duration(380)}
      style={{ position: 'absolute', left, bottom, width: slot, height: size }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!reduce) press.value = withTiming(1, { duration: 70 });
        }}
        onPressOut={() => {
          if (!reduce) press.value = withSpring(0, { damping: 15, stiffness: 240 });
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          owned
            ? `${def.name}, ${(curioTier(owned.count).name ?? '').toLowerCase()}${
                owned.count > 1 ? `, ${owned.count} copies` : ''
              }`
            : 'Not found yet'
        }
        style={styles.itemPress}
      >
        {tier > 0 ? (
          <Animated.View
            style={[styles.tierGlow, { width: size, height: size }, glowStyle]}
            pointerEvents="none"
          >
            <Image
              source={GLOW}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={0}
              tintColor={look.tint}
            />
          </Animated.View>
        ) : null}
        <Animated.View style={[{ width: size, height: size }, artStyle]}>
          <Image
            source={def.art}
            style={[StyleSheet.absoluteFill, { opacity: owned ? 1 : 0.55 }]}
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
/** Warm soft-black, the ink the whole design system borders and prints with. */
const INK_BORDER = '#241E19';
/** Reserved in each page's scroll for the fixed chrome above and below it. */
const TOPBAR_H = 54;
const FOOTER_H = 116;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2018' },
  content: { alignItems: 'center', gap: 10 },
  topBar: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  roundBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(247,239,224,0.34)', backgroundColor: 'rgba(20,14,10,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { height: 7, borderRadius: 999, backgroundColor: INK },
  tally: {
    fontFamily: FONTS.monoBold, fontSize: 15, color: INK,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
    minWidth: 42, textAlign: 'right',
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
  tierGlow: { position: 'absolute', bottom: 0 },
  // Holds its height when empty so the shelves below never jump as the
  // selection moves between found and unfound curios.
  strip: {
    height: 30, marginTop: -4, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 5, paddingRight: 12, borderRadius: 999, borderWidth: 1,
    borderColor: 'rgba(247,239,224,0.16)', backgroundColor: 'rgba(20,14,10,0.5)',
  },
  stripGap: { height: 30, marginTop: -4 },
  stripSeal: { width: 22, height: 22 },
  stripName: {
    fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.8, color: '#F3C24C',
  },
  stripNameTop: { color: '#FFE9AE' },
  stripTrack: {
    width: 44, height: 4, borderRadius: 999, overflow: 'hidden',
    backgroundColor: 'rgba(247,239,224,0.18)',
  },
  stripFill: { height: 4, borderRadius: 999, backgroundColor: '#F3C24C' },
  stripCount: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.4,
    color: 'rgba(247,239,224,0.66)', fontVariant: ['tabular-nums'],
  },
  dupe: {
    position: 'absolute', right: 2, bottom: -4,
    paddingHorizontal: 5, borderRadius: 8, backgroundColor: 'rgba(20,14,10,0.72)',
  },
  dupeText: { fontFamily: FONTS.monoMedium, fontSize: 10, color: INK },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 14, paddingHorizontal: 20, alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(20,14,10,0.62)',
    borderTopWidth: 1, borderTopColor: 'rgba(247,239,224,0.12)',
  },
  cta: {
    minWidth: 250, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 16, borderWidth: 2, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 1.4 },
  footerNote: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.4,
    color: 'rgba(247,239,224,0.55)', textAlign: 'center',
  },
});
