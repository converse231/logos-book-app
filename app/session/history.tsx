import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ReadingSession, UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';

interface Row {
  session: ReadingSession;
  title: string;
  cover: string | null;
}

// Session history (Strava-style activity feed). Every logged session, newest first,
// with the book it belonged to. Tapping a row opens the per-session detail where
// the reader can review the stats and re-share the card.
export default function SessionHistory() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      Promise.all([api.getStats(), api.getUserBooks()])
        .then(([stats, books]) => {
          if (!alive) return;
          const byId = new Map<string, UserBook>(books.map((b) => [b.id, b]));
          const mapped = stats.sessions.map((s) => {
            const ub = byId.get(s.userBookId);
            return { session: s, title: ub?.book.title ?? 'A book', cover: ub?.book.coverUrl ?? null };
          });
          setRows(mapped);
        })
        .catch(() => alive && setError(true));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  const openDetail = (r: Row) => {
    Haptics.selectionAsync();
    const s = r.session;
    router.push({
      pathname: '/session/detail',
      params: {
        sessionId: s.id,
        title: r.title,
        cover: r.cover ?? '',
        format: s.format,
        startedAt: s.startedAt,
        durationSeconds: String(s.durationSeconds),
        pagesRead: s.pagesRead != null ? String(s.pagesRead) : '',
        minutesListened: s.minutesListened != null ? String(s.minutesListened) : '',
        pph: s.pph != null ? String(s.pph) : '',
        isPersonalBest: s.isPersonalBest ? '1' : '',
        xpAwarded: String(s.xpAwarded),
      },
    } as unknown as Href);
  };

  return (
    <ScreenBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Session history</Text>
        <View style={styles.spacer} />
      </View>

      {error && !rows ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : !rows ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={72} radius={0} />
          ))}
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={40} color={t.textTer} />
          <Text style={[styles.emptyText, { color: t.textSec }]}>
            No sessions yet. Start reading to build your history.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.session.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <SessionRow row={item} onPress={() => openDetail(item)} t={t} />}
        />
      )}
    </ScreenBackground>
  );
}

function SessionRow({ row, onPress, t }: { row: Row; onPress: () => void; t: ReturnType<typeof useTheme> }) {
  const s = row.session;
  const isAudio = s.format === 'audiobook';
  // A "check-in" (I read today) carries no pages or duration — show it as such
  // rather than a misleading "0 pages · 1 min".
  const isCheckIn = s.durationSeconds === 0 && (s.pagesRead ?? 0) === 0 && (s.minutesListened ?? 0) === 0;
  const minutes = Math.max(1, Math.round(s.durationSeconds / 60));
  const primary = isAudio
    ? `${s.minutesListened ?? minutes} min listened`
    : `${s.pagesRead ?? 0} ${(s.pagesRead ?? 0) === 1 ? 'page' : 'pages'}`;
  const secondary = isAudio
    ? `${minutes} min`
    : `${minutes} min${s.pph != null ? ` · ${s.pph} pg/hr` : ''}`;
  const stats = isCheckIn ? 'Reading check-in' : `${primary} · ${secondary}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${stats}`}
      style={({ pressed }) => [styles.row, { borderColor: t.border, backgroundColor: t.bgSec }, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.coverFrame, { borderColor: t.border }]}>
        <BookCover url={row.cover} title={row.title} format={s.format} width={40} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={1}>{row.title}</Text>
        <Text style={[styles.rowStats, { color: t.textSec }]} numberOfLines={1}>
          {stats}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {s.isPersonalBest ? <Ionicons name="trophy" size={14} color={t.gold} /> : null}
        <Text style={[styles.rowDate, { color: t.textTer }]}>{shortDate(s.startedAt)}</Text>
      </View>
    </Pressable>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  roundBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 42, height: 42 },
  title: { fontFamily: FONTS.uiBold, fontSize: 18 },
  list: { paddingHorizontal: 18, gap: 10, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: BORDER_WIDTH },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 14 },
  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
  rowStats: { fontFamily: FONTS.mono, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowDate: { fontFamily: FONTS.mono, fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyText: { fontFamily: FONTS.uiMedium, fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
