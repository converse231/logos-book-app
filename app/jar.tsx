import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { PressBlock } from '@/components/shared/PressBlock';
import { FireflyJar } from '@/components/jar/FireflyJar';
import { CURIO_KEYS, POUCH_COST } from '@/components/curio/curios';
import { markFirefliesSeen } from '@/lib/jarSeen';
import type { OwnedCurio } from '@/services/types';

const BG_DAY = require('@/assets/curio/bg-jar-day.webp');
const BG_NIGHT = require('@/assets/curio/bg-jar-night.webp');

// The firefly jar — your reading currency, made physical.
//
// Fireflies come in from reading and go out as pouches. This screen only ever
// SHOWS the balance: the spend lives on the collection, where the shelf you are
// looking at is the shelf the pouch rolls from, and where the curio you pull
// lands in front of you instead of on a screen you then have to leave.
//
// Painted backdrop rather than the paper substrate, because the jar and the
// shelves are one place and the reader walks between them. That means this
// screen leaves the theme tokens behind and uses the collection's fixed
// cream-on-dark palette — a themed `t.text` over a painting is a coin flip.
export default function JarScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const [balance, setBalance] = useState<number | null>(null);
  const [curios, setCurios] = useState<OwnedCurio[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getProfile()
        .then((p) => {
          if (!alive) return;
          const n = p.fireflies ?? 0;
          setBalance(n);
          // Opening the jar IS seeing it — clears the header badge next focus.
          markFirefliesSeen(n);
        })
        .catch(() => alive && setBalance(0));
      // Only for the count on the way through to the shelves.
      api.getCurios()
        .then((c) => alive && setCurios(c))
        .catch(() => alive && setCurios([]));
      return () => {
        alive = false;
      };
    }, [api])
  );

  // Same room, different hour. Read once per render rather than on a timer —
  // nobody sits on this screen through dusk, and a ticking clock here would
  // cost a re-render a minute for a backdrop swap nobody is waiting for.
  const hour = new Date().getHours();
  const night = hour < 6 || hour >= 18;

  const jarW = Math.min(300, width * 0.78);
  // Not modulo: at exactly POUCH_COST the remainder is 0, which drew an EMPTY
  // bar under a visually full jar reading "enough for a pouch".
  const toNext = balance == null ? 0 : Math.max(0, POUCH_COST - balance);
  const fill = balance == null ? 0 : Math.min(1, balance / POUCH_COST);
  const full = balance != null && balance >= POUCH_COST;
  const found = curios == null ? null : curios.length;

  return (
    <View style={styles.root}>
      <Image
        source={night ? BG_NIGHT : BG_DAY}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
      />
      {/* The day painting is three times brighter than the night one, so it takes
          three times the scrim for the same cream text to hold — 6.4:1 against
          14.7:1. A single shared value would either wash out the day or crush
          the night, the same trade the two collection backdrops make. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: night ? 'rgba(20,14,10,0.26)' : 'rgba(20,14,10,0.52)' },
        ]}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
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
        </View>

        <Animated.View entering={reduce ? undefined : FadeInUp.duration(420)} style={styles.head}>
          <Text style={styles.title}>Your jar</Text>
          <Text style={styles.sub}>Every session you read puts fireflies in it.</Text>
        </Animated.View>

        {/* Drawn from the first frame at whatever is known, rather than behind a
            Skeleton: the skeleton is a themed cream block and would flash a hole
            in the painting for the ~300ms the profile takes. An empty jar filling
            up is a better half-second than a grey rectangle. */}
        <Animated.View
          entering={reduce ? undefined : FadeIn.delay(120).duration(520)}
          style={styles.jarWrap}
        >
          <FireflyJar
            balance={balance ?? 0}
            width={jarW}
            // The jar is decorative; the count below carries the meaning, so a
            // screen reader gets one clear sentence instead of 26 bugs.
            style={undefined}
          />
        </Animated.View>

        <Animated.View
          entering={reduce ? undefined : FadeInUp.delay(200).duration(420)}
          style={styles.readout}
          accessibilityRole="text"
          accessibilityLabel={
            balance == null
              ? 'Loading your firefly jar'
              : `${balance} fireflies. ${full ? 'Your jar is full.' : `${toNext} more fills it.`}`
          }
        >
          <View style={styles.countRow}>
            <Text style={styles.count} allowFontScaling={false}>
              {balance ?? '—'}
            </Text>
            <Text style={styles.unit}>{balance === 1 ? 'FIREFLY' : 'FIREFLIES'}</Text>
          </View>

          <View style={styles.progWrap}>
            <ProgressBar
              value={fill}
              max={1}
              height={8}
              accent={GOLD}
              track="rgba(20,14,10,0.5)"
              border="rgba(247,239,224,0.28)"
            />
            <Text style={styles.progText}>
              {balance == null
                ? ' '
                : full
                ? 'Enough for a pouch.'
                : `${toNext} more ${toNext === 1 ? 'firefly' : 'fireflies'} for a pouch`}
            </Text>
          </View>

          {/* One action, and it is the way onward: the pouch is opened on the
              shelf itself. Primary press — into the shadow, springing back past
              rest on release. */}
          <PressBlock
            onPress={() => router.push('/collection' as Href)}
            emphasis="primary"
            haptic="medium"
            radius={16}
            containerStyle={styles.ctaWrap}
            style={[styles.cta, { backgroundColor: CORAL, borderColor: INK_BORDER }]}
            accessibilityLabel={
              found == null
                ? 'Your collection'
                : `Your collection, ${found} of ${CURIO_KEYS.length} found`
            }
          >
            <Text style={styles.ctaText}>YOUR COLLECTION</Text>
            <Text style={styles.ctaSub}>
              {found == null ? ' ' : `${found} OF ${CURIO_KEYS.length} FOUND`}
            </Text>
          </PressBlock>

          <Text style={styles.foot}>
            {full ? 'Open a pouch on either shelf.' : 'Pouches are opened on the shelves.'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// Fixed palette, matching app/collection.tsx — the two screens are one place.
const INK = '#F7EFE0';
const INK_BORDER = '#241E19';
const CORAL = '#F0764F';
const GOLD = '#F3C24C';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A2018' },
  content: { paddingHorizontal: 18, gap: 14, alignItems: 'center' },
  topBar: { alignSelf: 'stretch', flexDirection: 'row' },
  roundBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(247,239,224,0.34)', backgroundColor: 'rgba(20,14,10,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  head: { alignItems: 'center', gap: 4, marginTop: 4 },
  title: {
    fontFamily: FONTS.serifBold, fontSize: 30, lineHeight: 36,
    color: INK, textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.uiRegular, fontSize: 14.5, textAlign: 'center',
    maxWidth: 300, color: 'rgba(247,239,224,0.74)',
  },
  jarWrap: { alignItems: 'center', marginTop: 2 },
  readout: { alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  countRow: { alignItems: 'center', gap: 1 },
  count: {
    fontFamily: FONTS.monoBold, fontSize: 52, lineHeight: 56, color: INK,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  unit: {
    fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 3,
    color: 'rgba(247,239,224,0.66)',
  },
  progWrap: { alignSelf: 'center', width: '100%', maxWidth: 300, gap: 7, alignItems: 'center' },
  progText: {
    fontFamily: FONTS.mono, fontSize: 11.5, letterSpacing: 0.3,
    textAlign: 'center', color: 'rgba(247,239,224,0.6)',
  },
  ctaWrap: { marginTop: 6 },
  cta: {
    minWidth: 250, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 16, borderWidth: 2, alignItems: 'center',
  },
  ctaText: {
    fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 1.4, color: INK_BORDER,
  },
  // Ink on coral, held back a little so it reads as a subtitle without leaving
  // the accent — a second colour on an accent fill breaks the ink-on-coral rule.
  ctaSub: {
    fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.6, marginTop: 3,
    opacity: 0.62, color: INK_BORDER, fontVariant: ['tabular-nums'],
  },
  foot: {
    fontFamily: FONTS.uiRegular, fontSize: 13, textAlign: 'center',
    marginTop: 2, color: 'rgba(247,239,224,0.58)',
  },
});
