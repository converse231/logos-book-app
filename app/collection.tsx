import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { CURIOS, CURIO_KEYS, type CurioKey } from '@/components/curio/curios';
import type { OwnedCurio } from '@/services/types';

// The shelf. Thirteen curios, found one pouch at a time.
//
// Unfound ones are drawn as flat silhouettes rather than hidden: an empty slot
// you can see the shape of is an invitation, an absent slot is nothing at all.
export default function CollectionScreen() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const [owned, setOwned] = useState<OwnedCurio[] | null>(null);
  const [selected, setSelected] = useState<CurioKey | null>(null);

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
  const complete = found === total;

  // Three across, sized off the real content width so it holds on a small phone.
  const gap = 12;
  const cell = Math.floor((Math.min(width, 420) - gap * 2) / 3);

  const detail = selected ? CURIOS[selected] : null;
  const detailOwned = selected ? byKey.get(selected) : undefined;

  return (
    <ScreenBackground>
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
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
        </View>

        <Animated.View entering={reduce ? undefined : FadeInUp.duration(420)} style={styles.head}>
          <Text style={[styles.title, { color: t.text }]}>The forest floor</Text>
          <Text style={[styles.sub, { color: t.textSec }]}>
            {complete
              ? 'Every last one of them found.'
              : 'Small things worth stopping for. Pouches turn fireflies into them.'}
          </Text>
        </Animated.View>

        <View style={styles.countWrap}>
          <Text style={[styles.count, { color: t.text }]} allowFontScaling={false}>
            {owned == null ? '—' : found}
            <Text style={[styles.countTotal, { color: t.textTer }]}>{` / ${total}`}</Text>
          </Text>
          <View style={styles.bar}>
            <ProgressBar value={found} max={total} height={8} accent={t.gold} />
          </View>
        </View>

        <View style={[styles.grid, { gap }]}>
          {CURIO_KEYS.map((key, i) => {
            const def = CURIOS[key];
            const has = byKey.get(key);
            return (
              <Animated.View
                key={key}
                entering={reduce ? undefined : FadeIn.delay(60 + i * 28).duration(320)}
              >
                <Pressable
                  onPress={() => setSelected(key)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    has
                      ? `${def.name}, found${has.count > 1 ? `, ${has.count} of them` : ''}`
                      : 'Not found yet'
                  }
                  style={[
                    styles.cell,
                    {
                      width: cell,
                      height: cell,
                      backgroundColor: has ? t.bgSec : t.bgTer,
                      borderColor: selected === key ? t.gold : t.border,
                    },
                  ]}
                >
                  <Image
                    source={def.art}
                    style={[styles.art, !has && styles.artLocked]}
                    contentFit="contain"
                    transition={0}
                  />
                  {has && has.count > 1 ? (
                    <View style={[styles.badge, { backgroundColor: t.bgTer, borderColor: t.border }]}>
                      <Text style={[styles.badgeText, { color: t.textSec }]}>{`×${has.count}`}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {detail ? (
          <Animated.View
            entering={reduce ? undefined : FadeIn.duration(220)}
            style={[styles.detail, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Text style={[styles.detailName, { color: t.text }]}>
              {detailOwned ? detail.name : 'Not found yet'}
            </Text>
            <Text style={[styles.detailBlurb, { color: t.textSec }]}>
              {detailOwned ? detail.blurb : 'Open a pouch and see what turns up.'}
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 14, alignItems: 'center' },
  topBar: { alignSelf: 'stretch', flexDirection: 'row' },
  roundBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  head: { alignItems: 'center', gap: 4, marginTop: 4 },
  title: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 34, textAlign: 'center' },
  sub: { fontFamily: FONTS.uiRegular, fontSize: 14.5, textAlign: 'center', maxWidth: 320 },
  countWrap: { alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 2 },
  count: {
    fontFamily: FONTS.monoBold, fontSize: 30, lineHeight: 34,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  countTotal: { fontFamily: FONTS.mono, fontSize: 18 },
  bar: { alignSelf: 'center', width: '100%', maxWidth: 300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  cell: {
    borderRadius: 18, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', padding: 10,
  },
  art: { width: '100%', height: '100%' },
  // A found curio is full colour; an unfound one keeps its silhouette but loses
  // every bit of its character — that gap is the whole point of the screen.
  artLocked: { opacity: 0.16 },
  badge: {
    position: 'absolute', right: 5, bottom: 5,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 9, borderWidth: 1,
  },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 11 },
  detail: {
    alignSelf: 'stretch', maxWidth: 420, borderRadius: 18, borderWidth: 2,
    padding: 14, gap: 4, marginTop: 2,
  },
  detailName: { fontFamily: FONTS.serifBold, fontSize: 19 },
  detailBlurb: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
});
