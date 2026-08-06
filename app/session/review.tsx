import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { useApi } from '@/services/ApiContext';
import { localDateString, useSessionStore, uuidv4 } from '@/stores/sessionStore';
import { track } from '@/lib/analytics';
import { endReadingActivity } from '@/lib/liveActivity';
import { sendOrQueue } from '@/lib/sessionQueue';
import { clearActiveSession } from '@/lib/activeSession';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';

// Session Review — the step between finishing and celebrating.
//
// It exists because the old flow asked for your page in a cramped overlay and
// submitted immediately, so a mistyped number or a timer you forgot to stop was
// unfixable. Here nothing reaches the server until Save.
//
// Only two values are editable, and they're the two that actually go wrong: where
// you stopped, and how long it took. Everything under the dashed rule is derived
// and recomputes as you type — the dashes are the affordance saying "not tappable".
//
// Deliberately absent: XP, streak and badges. complete_session computes those and
// they don't exist yet. Review holds the facts you recorded; Success holds the
// rewards you earned.
export default function SessionReview() {
  const params = useLocalSearchParams<{ elapsedMs?: string }>();
  const router = useRouter();
  const t = useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const active = useSessionStore((s) => s.active);
  const setResult = useSessionStore((s) => s.setResult);

  const capturedMs = Math.max(0, parseInt(params.elapsedMs ?? '0', 10) || 0);
  const isAudio = active?.format === 'audiobook';
  const maxPage = active?.pageCount ?? null;

  // Starts EMPTY, not seeded with the start page. Pre-filling it meant a reader who
  // skimmed this screen could tap Save without ever touching it and silently record
  // a session with 0 pages read — the number looked answered when nobody had
  // answered it. Blank + autofocus + a gated Save makes the question unmissable.
  const [endPage, setEndPage] = useState('');
  const [minutes, setMinutes] = useState(String(Math.max(1, Math.round(capturedMs / 60000))));
  const [markFinished, setMarkFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const start = active?.startPage ?? 0;

  const derived = useMemo(() => {
    // Clamp the same way the tracker used to: never below where you started, never
    // past the book's length, so a fat-fingered number can't over-count pages_read.
    let end = Math.max(start, parseInt(endPage, 10) || start);
    if (maxPage && maxPage > 0) end = Math.min(end, maxPage);
    const mins = Math.max(1, parseInt(minutes, 10) || 1);
    const pages = end - start;
    return {
      end,
      mins,
      pages,
      pph: pages > 0 ? Math.round(pages / (mins / 60)) : 0,
      progress: maxPage && maxPage > 0 ? Math.min(1, end / maxPage) : null,
      atLastPage: !!maxPage && maxPage > 0 && end >= maxPage,
    };
  }, [endPage, minutes, start, maxPage]);

  // Nothing to review — the store was cleared out from under us (cold launch into
  // this route, say). Bounce home rather than render an empty shell.
  if (!active) {
    return (
      <ScreenBackground>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: t.textSec }]}>This session is no longer available.</Text>
          <PressBlock
            onPress={() => router.replace('/(tabs)/home' as Href)}
            accessibilityLabel="Go home"
            style={[styles.saveBtn, { backgroundColor: t.accent, borderColor: INK }]}
          >
            <Text style={styles.saveText}>GO HOME</Text>
          </PressBlock>
        </View>
      </ScreenBackground>
    );
  }

  // Audiobooks have no page field, so nothing to answer; otherwise the reader has
  // to have put a number in before Save comes alive.
  const canSave = isAudio || endPage.trim().length > 0;

  const save = () => {
    if (!canSave || submitting) return;
    // 0 pages is legitimate — studying one passage, re-reading, an interrupted
    // sit-down — so it's allowed, just never by accident.
    if (!isAudio && derived.pages === 0) {
      Keyboard.dismiss();
      Alert.alert(
        'No pages this time?',
        `You started and finished on page ${start}. The time still counts toward your streak.`,
        [
          { text: 'Change page', style: 'cancel' },
          { text: 'Save anyway', onPress: submit },
        ]
      );
      return;
    }
    submit();
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    Keyboard.dismiss();

    // Duration edits move endedAt, not a separate stored override: pace and XP are
    // derived server-side from startedAt/endedAt, so shifting the end is the only
    // way to keep every consumer agreeing on one number.
    const startedAtMs = active.startedAtMs;
    const endedAtMs = startedAtMs + derived.mins * 60000;

    const queued = {
      clientUuid: uuidv4(),
      userBookId: active.userBookId,
      bookId: active.bookId,
      format: active.format,
      startedAt: new Date(startedAtMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      startPage: isAudio ? null : start,
      endPage: isAudio ? null : derived.end,
      minutesListened: isAudio ? derived.mins : null,
      endPositionMin: null,
      localDate: localDateString(), // frozen at capture — the streak's source of truth
      source: 'live' as const,
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    try {
      const result = await sendOrQueue(api, queued);
      endReadingActivity();
      // Only now is the session recorded (or safely queued), so only now is the
      // recovery snapshot spent. Finishing the timer no longer drops it — a crash
      // between Finish and Save restores the session instead of losing it.
      clearActiveSession();

      if (result) {
        // Marking the book finished is a separate write, and deliberately after the
        // session: if it fails the session still counts, and status is trivially
        // fixable from the book detail screen.
        if (markFinished) {
          try {
            await api.updateBookStatus(active.userBookId, 'finished');
          } catch {
            /* non-fatal — the session is what matters here */
          }
        }
        setResult(result);
        track('session_completed', {
          format: active.format,
          pagesRead: result.pagesRead,
          durationSeconds: result.durationSeconds,
          isPersonalBest: result.isPersonalBest,
          xpGained: result.xpGained,
          source: 'live',
        });
        router.replace(`/(modals)/session-complete?finished=${markFinished ? '1' : '0'}` as Href);
      } else {
        router.replace('/(tabs)/home' as Href);
        Alert.alert(
          'Saved offline',
          "You're offline, so we saved this session. It'll sync — along with your streak and XP — automatically once you're back online.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const discard = () => {
    Alert.alert(
      'Discard this session?',
      "It won't be saved, and your streak, XP and progress stay exactly as they were.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            endReadingActivity();
            clearActiveSession();
            useSessionStore.getState().endSession();
            router.replace('/(tabs)/home' as Href);
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
            accessibilityLabel="Back to session"
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.textSec }]}>REVIEW SESSION</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bookRow}>
            {active.coverUrl ? (
              <Image source={{ uri: active.coverUrl }} style={styles.cover} contentFit="cover" transition={120} />
            ) : (
              <View style={[styles.cover, styles.coverFallback, { backgroundColor: t.bgTer, borderColor: t.border }]} />
            )}
            <View style={styles.bookMeta}>
              <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={2}>
                {active.bookTitle}
              </Text>
              <Text style={[styles.bookSub, { color: t.textSec }]}>
                {isAudio ? 'Audiobook' : `Started on page ${start}`}
              </Text>
            </View>
          </View>

          {/* The two editable values. */}
          {!isAudio ? (
            <Field
              label="End page"
              value={endPage}
              onChange={setEndPage}
              hint={maxPage ? `of ${maxPage}` : undefined}
              placeholder={String(start)}
              autoFocus
              accessibilityLabel="End page"
            />
          ) : null}
          <Field
            label="Duration"
            value={minutes}
            onChange={setMinutes}
            hint="minutes"
            accessibilityLabel="Duration in minutes"
          />

          {/* Derived, read-only. Dashed border + no shadow = not tappable. */}
          <View style={[styles.derived, { borderColor: t.textTer }]}>
            {/* Em-dashes until the page is answered: a literal 0 reads as a result,
                and "0 pages / 0 pages-per-hour" is exactly the wrong first
                impression when the real state is "not told yet". */}
            {!isAudio ? (
              <Derived value={canSave ? String(derived.pages) : '—'} label={derived.pages === 1 && canSave ? 'PAGE' : 'PAGES'} t={t} />
            ) : null}
            <Derived value={`${derived.mins}`} label="MINUTES" t={t} />
            {!isAudio ? <Derived value={canSave ? String(derived.pph) : '—'} label="PAGES/HR" t={t} /> : null}
            {derived.progress != null ? (
              <Derived value={canSave ? `${Math.round(derived.progress * 100)}%` : '—'} label="OF BOOK" t={t} />
            ) : null}
          </View>

          {/* Offered only when the end page actually reaches the last one — otherwise
              it's a control that's wrong ~99% of the time. */}
          {derived.atLastPage ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setMarkFinished((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: markFinished }}
              accessibilityLabel="Mark this book as finished"
              style={[
                styles.finishRow,
                {
                  backgroundColor: markFinished ? t.accentMuted : t.bgSec,
                  borderColor: t.border,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: t.border, backgroundColor: markFinished ? t.accent : 'transparent' },
                ]}
              >
                {markFinished ? <Ionicons name="checkmark" size={14} color={PALETTE.onAccent} /> : null}
              </View>
              <View style={styles.finishCopy}>
                <Text style={[styles.finishTitle, { color: t.text }]}>Mark as finished</Text>
                <Text style={[styles.finishSub, { color: t.textSec }]}>
                  You&rsquo;re on the last page — move it to your finished shelf.
                </Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <PressBlock
            onPress={save}
            disabled={submitting || !canSave}
            accessibilityLabel={canSave ? 'Save session' : 'Enter the page you finished on to save'}
            accessibilityState={{ disabled: !canSave }}
            style={[
              styles.saveBtn,
              { backgroundColor: canSave ? t.accent : t.bgTer, borderColor: INK },
              (submitting || !canSave) && { opacity: 0.6 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={PALETTE.onAccent} />
            ) : (
              <Text style={styles.saveText}>SAVE SESSION</Text>
            )}
          </PressBlock>
          <Pressable
            onPress={discard}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Discard this session"
            style={({ pressed }) => [styles.discard, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.discardText, { color: t.danger }]}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </ScreenBackground>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  placeholder,
  autoFocus,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      <View style={styles.fieldLeft}>
        <Text style={[styles.fieldLabel, { color: t.textSec }]}>{label.toUpperCase()}</Text>
        <View style={styles.fieldValueRow}>
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            autoFocus={autoFocus}
            maxLength={5}
            placeholder={placeholder}
            placeholderTextColor={t.textTer}
            accessibilityLabel={accessibilityLabel}
            style={[styles.fieldInput, { color: t.text }]}
          />
          {hint ? <Text style={[styles.fieldHint, { color: t.textTer }]}>{hint}</Text> : null}
        </View>
      </View>
      <View style={[styles.pencil, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
        <Ionicons name="pencil" size={12} color={t.accent} />
      </View>
    </View>
  );
}

function Derived({ value, label, t }: { value: string; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.derivedCell}>
      <Text style={[styles.derivedValue, { color: t.text }]}>{value}</Text>
      <Text style={[styles.derivedLabel, { color: t.textSec }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { ...CENTER_COLUMN, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingBottom: 10 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.6 },

  scroll: { ...CENTER_COLUMN, paddingHorizontal: 18, gap: 12 },

  bookRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 },
  cover: { width: 46, height: 68, borderRadius: RADIUS.sm },
  coverFallback: { borderWidth: BORDER_WIDTH },
  bookMeta: { flex: 1, minWidth: 0 },
  bookTitle: { fontFamily: FONTS.serifBold, fontSize: 18, lineHeight: 23 },
  bookSub: { fontFamily: FONTS.uiRegular, fontSize: 12, marginTop: 3 },

  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
    boxShadow: `3px 3px 0px ${INK}`,
  },
  fieldLeft: { flex: 1 },
  fieldLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.2 },
  fieldValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  fieldInput: {
    fontFamily: FONTS.monoBold, fontSize: 24, padding: 0, minWidth: 62,
    fontVariant: ['tabular-nums'], ...NO_FONT_PAD,
  },
  fieldHint: { fontFamily: FONTS.mono, fontSize: 12 },
  pencil: { width: 26, height: 26, borderRadius: RADIUS.sm, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },

  derived: {
    flexDirection: 'row', borderWidth: BORDER_WIDTH, borderStyle: 'dashed',
    borderRadius: RADIUS.md, paddingVertical: 11, marginTop: 2,
  },
  derivedCell: { flex: 1, alignItems: 'center' },
  derivedValue: { fontFamily: FONTS.monoBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  derivedLabel: { fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1, marginTop: 2 },

  finishRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md, marginTop: 4,
    boxShadow: `3px 3px 0px ${INK}`,
  },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  finishCopy: { flex: 1 },
  finishTitle: { fontFamily: FONTS.uiBold, fontSize: 14 },
  finishSub: { fontFamily: FONTS.uiRegular, fontSize: 11.5, lineHeight: 16, marginTop: 2 },

  footer: { ...CENTER_COLUMN, paddingHorizontal: 18, paddingTop: 10, gap: 4 },
  saveBtn: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md },
  saveText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  discard: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  discardText: { fontFamily: FONTS.uiSemiBold, fontSize: 13, letterSpacing: 0.3 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 15, textAlign: 'center' },
});
