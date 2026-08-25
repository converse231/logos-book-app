import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { PressBlock } from '@/components/shared/PressBlock';
import { Skeleton } from '@/components/shared/Skeleton';
import { FireflyJar } from '@/components/jar/FireflyJar';
import { POUCH_COST } from '@/components/curio/curios';
import { PouchReveal } from '@/components/curio/PouchReveal';
import { markFirefliesSeen } from '@/lib/jarSeen';
import type { PouchResult } from '@/services/types';

// The firefly jar — your reading currency, made physical.
//
// Fireflies come in from reading and go out as pouches. The spend is a single
// server RPC that decides the prize; nothing here rolls anything.
export default function JarScreen() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const [balance, setBalance] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<PouchResult | null>(null);
  // What the last pouch produced, so the collection can open on it.
  const [lastKey, setLastKey] = useState<string | null>(null);

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
      return () => {
        alive = false;
      };
    }, [api])
  );

  const jarW = Math.min(300, width * 0.78);
  // Not modulo: at exactly POUCH_COST the remainder is 0, which drew an EMPTY
  // bar under a visually full jar reading "enough for a pouch".
  const toNext = balance == null ? 0 : Math.max(0, POUCH_COST - balance);
  const fill = balance == null ? 0 : Math.min(1, balance / POUCH_COST);
  const full = balance != null && balance >= POUCH_COST;

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
      const r = await api.openPouch();
      if (r.ok) {
        setBalance(r.fireflies);
        markFirefliesSeen(r.fireflies);
        setLastKey(r.key);
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
  }, [api]);

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40 }]}
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
              {
                backgroundColor: pressed ? t.bgTer : t.bgSec,
                borderColor: t.border,
                transform: [{ scale: pressed ? 0.93 : 1 }],
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
        </View>

        <Animated.View entering={reduce ? undefined : FadeInUp.duration(420)} style={styles.head}>
          <Text style={[styles.title, { color: t.text }]}>Your jar</Text>
          <Text style={[styles.sub, { color: t.textSec }]}>
            Every session you read puts fireflies in it.
          </Text>
        </Animated.View>

        {balance == null ? (
          <View style={styles.jarWrap}>
            <Skeleton width={jarW} height={jarW / (561 / 760)} radius={18} />
          </View>
        ) : (
          <Animated.View entering={reduce ? undefined : FadeIn.delay(120).duration(520)} style={styles.jarWrap}>
            <FireflyJar
              balance={balance}
              width={jarW}
              // The jar is decorative; the count below carries the meaning, so a
              // screen reader gets one clear sentence instead of 26 bugs.
              style={undefined}
            />
          </Animated.View>
        )}

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
            <Text style={[styles.count, { color: t.text }]} allowFontScaling={false}>
              {balance ?? '—'}
            </Text>
            <Text style={[styles.unit, { color: t.textSec }]}>
              {balance === 1 ? 'FIREFLY' : 'FIREFLIES'}
            </Text>
          </View>

          <View style={styles.progWrap}>
            <ProgressBar
              value={fill}
              max={1}
              height={8}
              accent={t.gold}
            />
            <Text style={[styles.progText, { color: t.textTer }]}>
              {balance == null
                ? ' '
                : full
                ? 'Enough for a pouch.'
                : `${toNext} more for a pouch`}
            </Text>
          </View>

          {/* The screen's main action, so it gets the primary press: into the
              shadow, springing back past rest on release. */}
          <PressBlock
            onPress={openPouch}
            disabled={!full || opening}
            emphasis="primary"
            haptic="medium"
            radius={16}
            containerStyle={styles.ctaWrap}
            style={[
              styles.cta,
              { backgroundColor: full ? t.accent : t.bgTer, borderColor: t.border },
            ]}
            accessibilityLabel={
              full ? `Open a pouch for ${POUCH_COST} fireflies` : 'Not enough fireflies yet'
            }
            accessibilityState={{ disabled: !full || opening, busy: opening }}
          >
            <Text style={[styles.ctaText, { color: full ? t.onAccent : t.textTer }]}>
              {opening ? 'OPENING…' : `OPEN A POUCH · ${POUCH_COST}`}
            </Text>
          </PressBlock>

          <Pressable
            onPress={() =>
              router.push(
                (lastKey ? `/collection?focus=${encodeURIComponent(lastKey)}` : '/collection') as Href
              )
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="See your collection"
            style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Text style={[styles.link, { color: t.textSec }]}>See what you&apos;ve found</Text>
            <Ionicons name="chevron-forward" size={15} color={t.textSec} />
          </Pressable>
        </Animated.View>

      </ScrollView>

      {reveal ? <PouchReveal result={reveal} onDone={() => setReveal(null)} /> : null}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 14, alignItems: 'center' },
  topBar: { alignSelf: 'stretch', flexDirection: 'row' },
  roundBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', gap: 4, marginTop: 4 },
  title: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  sub: { fontFamily: FONTS.uiRegular, fontSize: 14.5, textAlign: 'center', maxWidth: 300 },
  jarWrap: { alignItems: 'center', marginTop: 2 },
  readout: { alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  countRow: { alignItems: 'center', gap: 1 },
  count: {
    fontFamily: FONTS.monoBold, fontSize: 52, lineHeight: 56,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  unit: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 3 },
  progWrap: { alignSelf: 'center', width: '100%', maxWidth: 300, gap: 7, alignItems: 'center' },
  progText: { fontFamily: FONTS.mono, fontSize: 11.5, letterSpacing: 0.3, textAlign: 'center' },
  ctaWrap: { marginTop: 6 },
  cta: {
    minWidth: 240, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 16, borderWidth: 2, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 1.4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4 },
  link: { fontFamily: FONTS.uiMedium, fontSize: 14 },
});
