import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, NO_FONT_PAD } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';

// Per-session detail (Strava activity view). Reads the session's stats from nav
// params (the history list already has them — no refetch) and offers a re-share
// that reopens the card composer for THIS session.
export default function SessionDetail() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{
    sessionId?: string;
    title?: string;
    cover?: string;
    format?: string;
    startedAt?: string;
    durationSeconds?: string;
    pagesRead?: string;
    minutesListened?: string;
    pph?: string;
    isPersonalBest?: string;
    xpAwarded?: string;
  }>();

  const [deleting, setDeleting] = useState(false);

  const isAudio = p.format === 'audiobook';
  const durationSeconds = Number(p.durationSeconds ?? 0);
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const pages = p.pagesRead ? Number(p.pagesRead) : 0;
  const minutesListened = p.minutesListened ? Number(p.minutesListened) : 0;
  const pph = p.pph ? Number(p.pph) : null;
  const isPB = p.isPersonalBest === '1';
  const xp = Number(p.xpAwarded ?? 0);
  // A check-in ("I read today") has no pages or duration — present it as such
  // instead of a hollow "0 pages / 1 min" readout.
  const isCheckIn = durationSeconds === 0 && pages === 0 && minutesListened === 0;

  const hero = isAudio ? String(p.minutesListened ?? minutes) : String(pages);
  const heroUnit = isAudio
    ? 'minutes listened'
    : pages === 1 ? 'page read' : 'pages read';

  const subStats: { label: string; value: string }[] = [
    { label: 'minutes', value: String(minutes) },
    // Pace is a whole number on the readout — "736.36 pages/hr" wraps the tile and
    // reads like false precision.
    ...(!isAudio && pph != null ? [{ label: 'pages/hr', value: String(Math.round(pph)) }] : []),
    { label: 'XP', value: `+${xp}` },
  ];

  // Remove this session from history. The RPC also reverses its XP (streak +
  // badges are kept); the history/stats screens refetch on focus when we go back.
  const del = () => {
    if (!p.sessionId || deleting) return;
    Alert.alert(
      'Delete this session?',
      "It'll be removed from your history and its XP taken back. Your streak and badges stay. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteSession(p.sessionId!);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch {
              setDeleting(false);
              Alert.alert('Could not delete', 'Something went wrong removing this session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const reshare = () => {
    router.push({
      pathname: '/(modals)/share-card',
      params: {
        title: p.title ?? '',
        cover: p.cover ?? '',
        format: p.format ?? 'physical',
        pages: String(pages),
        minutes: String(minutes),
        pph: pph != null ? String(pph) : '0',
      },
    } as unknown as Href);
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 32 }]}
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
          <Text style={[styles.topTitle, { color: t.text }]}>Session</Text>
          {p.sessionId ? (
            <Pressable
              onPress={del}
              disabled={deleting}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete this session"
              style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.danger }]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={t.danger} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={t.danger} />
              )}
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Book + date */}
        <View style={styles.bookRow}>
          <View style={[styles.coverFrame, { borderColor: t.border }]}>
            <BookCover url={p.cover || null} title={p.title ?? 'Book'} format={p.format as any} width={66} />
          </View>
          <View style={styles.bookInfo}>
            <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={2}>{p.title}</Text>
            <Text style={[styles.date, { color: t.textSec }]}>{longDate(p.startedAt)}</Text>
            {isPB ? (
              <View style={[styles.pbBadge, { backgroundColor: t.gold }]}>
                <Ionicons name="trophy" size={13} color={INK} />
                <Text style={styles.pbText}>PERSONAL BEST</Text>
              </View>
            ) : null}
          </View>
        </View>

        {isCheckIn ? (
          /* Check-in — no pages/duration to show; explain what it is */
          <View style={[styles.checkInCard, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
            <Ionicons name="flame" size={44} color={t.accent} />
            <Text style={[styles.checkInTitle, { color: t.text }]}>READING CHECK-IN</Text>
            <Text style={[styles.checkInSub, { color: t.textSec }]}>
              You checked in to keep your streak going{xp > 0 ? ` · +${xp} XP` : ''}.
            </Text>
          </View>
        ) : (
          <>
            {/* Hero stat */}
            <View style={[styles.heroCard, { backgroundColor: t.bgSec, borderColor: t.border }]}>
              <Text style={[styles.hero, { color: t.text }]}>{hero}</Text>
              <Text style={[styles.heroUnit, { color: t.textSec }]}>{heroUnit.toUpperCase()}</Text>
            </View>

            {/* Sub-stats row */}
            <View style={styles.statRow}>
              {subStats.map((s) => (
                <View key={s.label} style={[styles.statTile, { backgroundColor: t.bgSec, borderColor: t.border }]}>
                  <Text
                    style={[styles.statValue, { color: t.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {s.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: t.textSec }]} numberOfLines={1}>
                    {s.label.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Re-share — a check-in has nothing meaningful to put on a card */}
        {isCheckIn ? null : (
          <View style={styles.shareWrap}>
            <PressBlock onPress={reshare} accessibilityLabel="Share this session" style={[styles.shareBtn, { backgroundColor: t.accent }]}>
              <Ionicons name="share-social" size={20} color={PALETTE.onAccent} />
              <Text style={styles.shareText}>SHARE THIS SESSION</Text>
            </PressBlock>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function longDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 42, height: 42 },
  topTitle: { fontFamily: FONTS.uiBold, fontSize: 18 },

  bookRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 14 },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { fontFamily: FONTS.displayBold, fontSize: 20, lineHeight: 24 },
  date: { fontFamily: FONTS.mono, fontSize: 12 },
  pbBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, height: 24, borderRadius: 14 },
  pbText: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 0.8, color: INK },

  heroCard: { alignItems: 'center', paddingVertical: 28, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK },
  hero: { fontFamily: FONTS.uiBold, fontSize: 76, lineHeight: 80, fontVariant: ['tabular-nums'] },
  heroUnit: { fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 1.5, marginTop: 2 },

  checkInCard: { alignItems: 'center', gap: 10, paddingVertical: 30, paddingHorizontal: 24, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK },
  checkInTitle: { fontFamily: FONTS.uiBold, fontSize: 22, letterSpacing: 1 },
  checkInSub: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },

  statRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  statTile: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, paddingHorizontal: 8, minHeight: 92,
    borderRadius: 14, borderWidth: BORDER_WIDTH,
  },
  statValue: { fontFamily: FONTS.uiBold, fontSize: 26, fontVariant: ['tabular-nums'], ...NO_FONT_PAD },
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, marginTop: 4, ...NO_FONT_PAD },

  shareWrap: { marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56,
    borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
  },
  shareText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent },
});
