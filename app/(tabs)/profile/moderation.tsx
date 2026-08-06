import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import type { ReviewReport } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';
import { Skeleton } from '@/components/shared/Skeleton';
import { StarRating } from '@/components/library/StarRating';
import { Q } from '@/components/shared/Q';

// Moderation queue — the other half of review reporting.
//
// Reachable only from Settings, and only when users.is_admin is true. There is no
// client-side permission check beyond hiding the link: RLS is the actual gate, so
// a non-admin who reached this route by any means sees an empty queue and any
// action they attempt fails at the database.
//
// Deliberately small. Two buttons per report — take it down, or leave it up — and
// no bulk tools, no filters, no pagination beyond a 100-row cap. At this scale a
// queue that needs its own workflow is a queue nobody reads.
export default function Moderation() {
  const t = useTheme();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reports, setReports] = useState<ReviewReport[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .getReviewReports()
        .then((r) => alive && setReports(r))
        .catch(() => alive && setReports([]))
        .finally(() => alive && setRefreshing(false));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  const resolve = (report: ReviewReport, action: 'removed' | 'dismissed') => {
    const isRemoval = action === 'removed';
    Alert.alert(
      isRemoval ? 'Remove this review?' : 'Leave this review up?',
      isRemoval
        ? "It will be deleted for everyone. This can't be undone."
        : 'The report is closed and the review stays visible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isRemoval ? 'Remove' : 'Keep it',
          style: isRemoval ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(report.id);
            try {
              await api.resolveReport(report.id, action);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Drop every report on that review, matching what the server did.
              setReports((list) => (list ?? []).filter((r) => r.reviewId !== report.reviewId));
            } catch {
              Alert.alert('Could not save', 'Something went wrong. Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenBackground>
      <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.textSec }]}>REPORTED REVIEWS</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setNonce((n) => n + 1);
              }}
              tintColor={t.accent}
            />
          }
        >
          {reports === null ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={150} radius={RADIUS.md} />
              <Skeleton height={150} radius={RADIUS.md} />
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.empty}>
              <Q expression="happy" size={130} decorative />
              <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing reported</Text>
              <Text style={[styles.emptyBody, { color: t.textSec }]}>
                When a reader flags a review it lands here for you to judge.
              </Text>
            </View>
          ) : (
            reports.map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: t.bgSec, borderColor: t.border }]}>
                <View style={styles.reasonRow}>
                  <View style={[styles.reasonChip, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
                    <Text style={[styles.reasonText, { color: t.text }]} numberOfLines={1}>
                      {r.reason}
                    </Text>
                  </View>
                  <Text style={[styles.meta, { color: t.textTer }]} numberOfLines={1}>
                    {r.reporterName ?? 'A reader'}
                  </Text>
                </View>

                {r.review ? (
                  <>
                    <View style={styles.bookRow}>
                      <StarRating value={r.review.rating} size={13} />
                      <Text style={[styles.meta, { color: t.textSec }]} numberOfLines={1}>
                        {r.review.authorName ?? 'Reader'}
                        {r.review.bookTitle ? ` · ${r.review.bookTitle}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.body, { color: t.text }]}>
                      {r.review.body?.trim() || 'Rating only — no written review.'}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.gone, { color: t.textTer }]}>
                    This review has already been deleted.
                  </Text>
                )}

                <View style={styles.actions}>
                  <PressBlock
                    onPress={() => resolve(r, 'dismissed')}
                    disabled={busy === r.id}
                    accessibilityLabel="Leave this review up"
                    style={[styles.btn, { backgroundColor: t.bgTer, borderColor: t.border }, busy === r.id && styles.dim]}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>KEEP</Text>
                  </PressBlock>
                  <PressBlock
                    onPress={() => resolve(r, 'removed')}
                    disabled={busy === r.id || !r.review}
                    accessibilityLabel="Remove this review"
                    style={[
                      styles.btn,
                      { backgroundColor: t.danger, borderColor: INK },
                      (busy === r.id || !r.review) && styles.dim,
                    ]}
                  >
                    <Text style={[styles.btnText, { color: '#FCF8ED' }]}>REMOVE</Text>
                  </PressBlock>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { ...CENTER_COLUMN, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingBottom: 12 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.6 },

  scroll: { ...CENTER_COLUMN, paddingHorizontal: 18, gap: 14 },

  card: {
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md, padding: 15, gap: 10,
    boxShadow: `4px 4px 0px ${INK}`,
  },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reasonChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: BORDER_WIDTH, flexShrink: 1 },
  reasonText: { fontFamily: FONTS.uiBold, fontSize: 11.5, letterSpacing: 0.2 },
  meta: { fontFamily: FONTS.mono, fontSize: 10.5, flexShrink: 1 },

  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { fontFamily: FONTS.serifMedium, fontSize: 16, lineHeight: 23 },
  gone: { fontFamily: FONTS.uiRegular, fontSize: 13, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  btn: {
    flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.sm,
  },
  dim: { opacity: 0.5 },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 12.5, letterSpacing: 1, ...NO_FONT_PAD },

  empty: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontFamily: FONTS.serifBold, fontSize: 21, marginTop: 6 },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
