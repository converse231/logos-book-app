import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, NO_FONT_PAD } from '@/theme/tokens';
import { useContentWidth } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { BookCover } from '@/components/shared/BookCover';
import { Skeleton } from '@/components/shared/Skeleton';
import { PressBlock } from '@/components/shared/PressBlock';
import { ReadingRhythm } from '@/components/library/ReadingRhythm';
import {
  buildBookReport,
  formatDuration,
  formatHour,
  shortDate,
  type BookReport,
} from '@/lib/bookReport';
import type { UserBook } from '@/services/types';

// The reading report for a finished book.
//
// Everything here is derived client-side in lib/bookReport.ts from data the app
// already has — no new endpoint, same approach as the profile dashboard. The
// screen's whole job is to render it and stagger it in.
export default function BookReportScreen() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const width = useContentWidth();

  const { userBookId } = useLocalSearchParams<{ userBookId?: string }>();
  const [book, setBook] = useState<UserBook | null>(null);
  const [report, setReport] = useState<BookReport | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!userBookId) {
        setFailed(true);
        return;
      }
      Promise.all([api.getUserBook(userBookId), api.getStats(), api.getUserBooks()])
        .then(([ub, stats, all]) => {
          if (!alive) return;
          setBook(ub);
          setReport(buildBookReport(ub, stats.sessions, all));
        })
        .catch(() => alive && setFailed(true));
      return () => {
        alive = false;
      };
    }, [api, userBookId])
  );

  const isAudio = report?.format === 'audiobook';
  const unit = isAudio ? 'minutes' : 'pages';

  // The three that lead. Pace is the one readers quote at each other, so it sits
  // with the headline numbers rather than in the detail below.
  const primary = report
    ? [
        { label: 'Time spent', value: formatDuration(report.totalMinutes) },
        { label: 'Sessions', value: String(report.sessions) },
        isAudio
          ? { label: 'Avg session', value: formatDuration(report.avgSessionMinutes) }
          : { label: 'Pace', value: report.pagesPerHour != null ? `${report.pagesPerHour} p/h` : '—' },
      ]
    : [];

  // Kept deliberately disjoint from `primary`: an audiobook's "time spent" and
  // "total listened" are the same number, and printing it twice makes the page
  // look padded rather than detailed.
  const secondary = !report
    ? []
    : isAudio
    ? [
        { label: 'Longest sitting', value: formatDuration(report.longestSessionMinutes) },
        { label: 'Days read', value: String(report.daysRead) },
      ]
    : [
        { label: 'Pages', value: report.totalPages != null ? String(report.totalPages) : '—' },
        {
          label: 'Per session',
          value: report.avgPagesPerSession != null ? `${report.avgPagesPerSession} p` : '—',
        },
        { label: 'Longest sitting', value: formatDuration(report.longestSessionMinutes) },
      ];

  // Lines, not tiles: these are observations about how you read, and a number in
  // a box would flatten them back into statistics.
  const notes: string[] = [];
  if (report) {
    if (report.daysToFinish != null) {
      notes.push(
        report.daysRead === report.daysToFinish
          ? `You read it every single day — ${report.daysRead} of ${report.daysToFinish}.`
          : `You read on ${report.daysRead} of those ${report.daysToFinish} days.`
      );
    }
    if (report.longestPauseDays >= 2) {
      notes.push(`The longest you left it alone was ${report.longestPauseDays} days.`);
    }
    if (report.peakHour != null) {
      notes.push(`Most of it happened around ${formatHour(report.peakHour)}.`);
    }
    if (report.longestSessionDate && report.longestSessionMinutes >= 20) {
      notes.push(
        `Your longest stretch was ${formatDuration(report.longestSessionMinutes)} on ${shortDate(
          report.longestSessionDate
        )}.`
      );
    }
    if (report.vsAverageDays != null && Math.abs(report.vsAverageDays) >= 2) {
      notes.push(
        report.vsAverageDays < 0
          ? `That's ${Math.abs(report.vsAverageDays)} days faster than your average book.`
          : `That's ${report.vsAverageDays} days longer than your average book.`
      );
    }
    if (report.personalBests > 0) {
      notes.push(
        report.personalBests === 1
          ? 'One session in here was a personal best.'
          : `${report.personalBests} sessions in here were personal bests.`
      );
    }
  }

  const share = () => {
    if (!book || !report) return;
    router.push({
      pathname: '/(modals)/share-card',
      params: {
        report: '1',
        title: book.book.title,
        cover: book.book.coverUrl ?? '',
        format: book.format,
        days: String(report.daysToFinish ?? ''),
        minutes: String(report.totalMinutes),
        sessionCount: String(report.sessions),
        pace: report.pagesPerHour != null ? String(report.pagesPerHour) : '',
        bookPages: report.totalPages != null ? String(report.totalPages) : '',
      },
    } as unknown as Href);
  };

  const anim = (i: number) => (reduce ? undefined : FadeInUp.delay(60 + i * 70).duration(420));

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

        {failed ? (
          <Text style={[styles.empty, { color: t.textSec }]}>
            That report could not be loaded. Go back and try again.
          </Text>
        ) : !book || !report ? (
          <View style={styles.loading}>
            <Skeleton width={width * 0.5} height={26} radius={8} />
            <Skeleton width={width} height={160} radius={18} />
            <Skeleton width={width} height={120} radius={18} />
          </View>
        ) : !report.hasSessions ? (
          <Animated.View entering={anim(0)} style={styles.head}>
            <Text style={[styles.title, { color: t.text }]}>{book.book.title}</Text>
            <Text style={[styles.empty, { color: t.textSec }]}>
              You marked this finished without tracking any sessions, so there is
              nothing to report. Books you read with the timer get a full one.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={anim(0)} style={styles.head}>
              <BookCover
                url={book.book.coverUrl}
                title={book.book.title}
                format={book.format}
                width={92}
              />
              <View style={styles.headText}>
                <Text style={[styles.kicker, { color: t.gold }]}>READING REPORT</Text>
                <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
                  {book.book.title}
                </Text>
                {book.book.authors?.length ? (
                  <Text style={[styles.author, { color: t.textSec }]} numberOfLines={1}>
                    {book.book.authors.join(', ')}
                  </Text>
                ) : null}
              </View>
            </Animated.View>

            {/* The headline: how long it took. */}
            <Animated.View entering={anim(1)} style={styles.block}>
              <Card glow padded>
                <Text style={[styles.heroLabel, { color: t.textSec }]}>
                  {report.finishedAt ? `Finished ${shortDate(report.finishedAt)}` : 'Finished'}
                </Text>
                <View style={styles.heroRow}>
                  <Text style={[styles.hero, { color: t.text }]} allowFontScaling={false}>
                    {report.daysToFinish ?? '—'}
                  </Text>
                  <Text style={[styles.heroUnit, { color: t.textSec }]}>
                    {report.daysToFinish === 1 ? 'DAY' : 'DAYS'}
                  </Text>
                </View>
                <View style={styles.primaryRow}>
                  {primary.map((s) => (
                    <View key={s.label} style={styles.primaryCell}>
                      <Text style={[styles.pValue, { color: t.text }]}>{s.value}</Text>
                      <Text style={[styles.pLabel, { color: t.textTer }]}>
                        {s.label.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>

            {/* The shape of the read. */}
            <Animated.View entering={anim(2)} style={styles.block}>
              <Card padded>
                <Text style={[styles.sectionLabel, { color: t.textSec }]}>THE RHYTHM</Text>
                <ReadingRhythm
                  bars={report.rhythm}
                  weekly={report.rhythmWeekly}
                  unit={unit}
                  height={86}
                />
              </Card>
            </Animated.View>

            {secondary.length ? (
              <Animated.View entering={anim(3)} style={styles.block}>
                <View style={styles.tiles}>
                  {secondary.map((s) => (
                    <Card key={s.label} padded style={styles.tile}>
                      <Text style={[styles.tValue, { color: t.text }]}>{s.value}</Text>
                      <Text style={[styles.tLabel, { color: t.textTer }]}>
                        {s.label.toUpperCase()}
                      </Text>
                    </Card>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {notes.length ? (
              <Animated.View entering={anim(4)} style={styles.block}>
                <Card padded>
                  <Text style={[styles.sectionLabel, { color: t.textSec }]}>HOW IT WENT</Text>
                  <View style={styles.notes}>
                    {notes.map((n, i) => (
                      <View key={i} style={styles.noteRow}>
                        <View style={[styles.dot, { backgroundColor: t.gold }]} />
                        <Text style={[styles.note, { color: t.text }]}>{n}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </Animated.View>
            ) : null}

            <Animated.View entering={anim(5)} style={styles.shareWrap}>
              <PressBlock
                onPress={share}
                emphasis="primary"
                haptic="medium"
                radius={16}
                style={[styles.shareBtn, { backgroundColor: t.accent, borderColor: t.border }]}
                accessibilityLabel="Share this reading report"
              >
                <Ionicons name="share-outline" size={17} color={t.onAccent} />
                <Text style={[styles.shareText, { color: t.onAccent }]}>SHARE THIS READ</Text>
              </PressBlock>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 12 },
  topBar: { alignSelf: 'stretch', flexDirection: 'row' },
  roundBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  loading: { gap: 14, marginTop: 10 },
  empty: {
    fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginTop: 16, paddingHorizontal: 12,
  },
  head: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 4, marginBottom: 4 },
  headText: { flex: 1, gap: 3, paddingTop: 2 },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 2.2 },
  title: { fontFamily: FONTS.serifBold, fontSize: 24, lineHeight: 29 },
  author: { fontFamily: FONTS.uiRegular, fontSize: 14 },
  block: { alignSelf: 'stretch' },
  heroLabel: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  hero: {
    fontFamily: FONTS.monoBold, fontSize: 54, lineHeight: 58,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  heroUnit: { fontFamily: FONTS.monoMedium, fontSize: 12, letterSpacing: 2.4 },
  primaryRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  primaryCell: { flex: 1, gap: 2 },
  pValue: {
    fontFamily: FONTS.monoBold, fontSize: 17,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  pLabel: { fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: 1.3 },
  sectionLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 2, marginBottom: 12 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 2 },
  tValue: {
    fontFamily: FONTS.monoBold, fontSize: 19,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  tLabel: { fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: 1.3 },
  notes: { gap: 9 },
  noteRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  note: { flex: 1, fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 21 },
  shareWrap: { alignItems: 'center', marginTop: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 16, borderWidth: 2, minWidth: 230, justifyContent: 'center',
  },
  shareText: { fontFamily: FONTS.monoBold, fontSize: 13, letterSpacing: 1.4 },
});
