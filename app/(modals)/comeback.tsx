import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ComebackChallenge, UserBook } from '@/services/types';
import { LoadingIndicator } from '@/components/shared/LoadingIndicator';
import { PressBlock } from '@/components/shared/PressBlock';

// Comeback Challenge (blueprint Section 5). A streak broke; finish 3 sessions
// before it expires to restore it. Loss-aversion framed in gold. Deep link:
// logos://comeback.
export default function Comeback() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const isDark = t.mode === 'dark';

  const [comeback, setComeback] = useState<ComebackChallenge | null | undefined>(undefined);
  const [activeBook, setActiveBook] = useState<UserBook | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getHomeData().then((h) => {
        if (!alive) return;
        setComeback(h.comeback);
        setActiveBook(h.activeBook);
      });
      return () => {
        alive = false;
      };
    }, [api])
  );

  const close = () => router.back();
  const startSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace((activeBook ? `/session/${activeBook.id}` : '/(tabs)/library') as Href);
  };

  const daysLeft = comeback
    ? Math.max(0, Math.ceil((new Date(comeback.expiresAt).getTime() - Date.now()) / 86400000))
    : 0;
  const done = comeback?.sessionsCompleted ?? 0;

  return (
    <View style={styles.root}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(3,4,6,0.72)' : 'rgba(17,19,24,0.5)' }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={close}
      />

      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        {comeback === undefined ? (
          <LoadingIndicator />
        ) : comeback === null ? (
          <View style={[styles.panel, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Text style={[styles.title, { color: t.text }]}>No active challenge</Text>
            <Text style={[styles.body, { color: t.textSec }]}>
              Keep your streak alive and you’ll never need one.
            </Text>
            <PressBlock onPress={close} accessibilityLabel="Got it" containerStyle={styles.ctaWrap} style={[styles.cta, { backgroundColor: t.accent, borderColor: t.border }]}>
              <Text style={styles.ctaText}>Got it</Text>
            </PressBlock>
          </View>
        ) : (
          <AnimatedPanel reduce={reduce}>
            <View style={[styles.panel, { backgroundColor: t.bgSec, borderColor: 'rgba(255,197,61,0.4)' }]}>
              <Pressable
                onPress={close}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.closeBtn, { backgroundColor: t.bgTer }]}
              >
                <Ionicons name="close" size={20} color={t.text} />
              </Pressable>

              <View style={[styles.glyph, { backgroundColor: 'rgba(255,197,61,0.16)' }]}>
                <Ionicons name="flame" size={40} color={t.gold} />
              </View>

              <Text style={[styles.kicker, { color: t.gold }]}>COMEBACK CHALLENGE</Text>
              <Text style={[styles.title, { color: t.text }]}>Restore your {comeback.streakAtBreak}-day streak</Text>
              <Text style={[styles.body, { color: t.textSec }]}>
                Finish three sessions before the window closes and your streak comes back to life.
              </Text>

              {/* 3-session progress */}
              <View style={styles.sessions}>
                {[0, 1, 2].map((i) => {
                  const filled = i < done;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.session,
                        { backgroundColor: filled ? 'rgba(255,197,61,0.18)' : t.bgTer, borderColor: filled ? t.gold : t.border },
                      ]}
                    >
                      <Ionicons name={filled ? 'flame' : 'flame-outline'} size={22} color={filled ? t.gold : t.textTer} />
                      <Text style={[styles.sessionLabel, { color: filled ? t.gold : t.textTer }]}>{i + 1}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={16} color={t.textSec} />
                <Text style={[styles.countdown, { color: t.textSec }]}>
                  {done} of 3 done · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </Text>
              </View>

              <PressBlock onPress={startSession} accessibilityLabel="Start a session" containerStyle={styles.ctaWrap} style={[styles.cta, { backgroundColor: t.accent, borderColor: t.border }]}>
                <Ionicons name="play" size={18} color={PALETTE.onAccent} />
                <Text style={styles.ctaText}>Start a session</Text>
              </PressBlock>
              <Pressable onPress={close} style={styles.later} accessibilityRole="button" accessibilityLabel="Maybe later">
                <Text style={[styles.laterText, { color: t.textSec }]}>Maybe later</Text>
              </Pressable>
            </View>
          </AnimatedPanel>
        )}
      </View>
    </View>
  );
}

function AnimatedPanel({ reduce, children }: { reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <>{children}</>;
  return <Animated.View entering={FadeInUp.duration(360)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  panel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 0,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...({ boxShadow: '4px 4px 0px #141414' } as const),
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  glyph: { width: 80, height: 80, borderRadius: 0, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 4 },
  kicker: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.4 },
  title: { fontFamily: FONTS.displayBold, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 4 },
  sessions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  session: { width: 74, height: 74, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  sessionLabel: { fontFamily: FONTS.uiBold, fontSize: 12 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  countdown: { fontFamily: FONTS.uiMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  ctaWrap: { alignSelf: 'stretch', marginTop: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 16, color: PALETTE.onAccent },
  later: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  laterText: { fontFamily: FONTS.uiMedium, fontSize: 14 },
});
