import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Skeleton } from '@/components/shared/Skeleton';
import { Q } from '@/components/shared/Q';
import { FireflyJar, POUCH_COST } from '@/components/jar/FireflyJar';

// The firefly jar — your reading currency, made physical.
//
// Read-only for now. Fireflies have been banking server-side since the
// migration landed, so this screen opens with a balance already built rather
// than at zero. Trading a full jar for a pouch is the next phase; until the
// collection exists there is nothing to trade for, and a button that does
// nothing is worse than no button.
export default function JarScreen() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const [balance, setBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getProfile()
        .then((p) => alive && setBalance(p.fireflies ?? 0))
        .catch(() => alive && setBalance(0));
      return () => {
        alive = false;
      };
    }, [api])
  );

  const jarW = Math.min(300, width * 0.78);
  const toNext = balance == null ? 0 : Math.max(0, POUCH_COST - (balance % POUCH_COST));
  const full = balance != null && balance >= POUCH_COST;

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
            style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
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
              value={balance == null ? 0 : Math.min(1, (balance % POUCH_COST) / POUCH_COST)}
              max={1}
              height={8}
              accent={t.gold}
            />
            <Text style={[styles.progText, { color: t.textTer }]}>
              {balance == null
                ? ' '
                : full
                ? 'Full jar — pouches are coming soon.'
                : `${toNext} more to fill the jar`}
            </Text>
          </View>
        </Animated.View>

        {balance === 0 ? (
          <Animated.View entering={reduce ? undefined : FadeIn.delay(320).duration(420)} style={styles.empty}>
            <Q expression="looking-up" size={120} decorative />
            <Text style={[styles.emptyText, { color: t.textSec }]}>
              Nothing in here yet. Finish a reading session and the first one turns up.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={reduce ? undefined : FadeIn.delay(320).duration(420)}>
            <Text style={[styles.note, { color: t.textTer }]}>
              A longer session, or more pages, puts more in.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
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
  progWrap: { alignSelf: 'stretch', maxWidth: 320, gap: 7, alignItems: 'center' },
  progText: { fontFamily: FONTS.mono, fontSize: 11.5, letterSpacing: 0.3, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8, marginTop: 8 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 13, textAlign: 'center', maxWidth: 280, marginTop: 4 },
});
