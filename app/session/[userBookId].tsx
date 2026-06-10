import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { ANIMATION, FONTS, PALETTE, INK, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { UserBook } from '@/services/types';
import { localDateString, useSessionStore, uuidv4 } from '@/stores/sessionStore';
import { track } from '@/lib/analytics';
import { PressBlock } from '@/components/shared/PressBlock';
import { SessionTimer } from '@/components/session/SessionTimer';
import { SessionControlBar } from '@/components/session/SessionControlBar';
import { ReadingCarousel } from '@/components/session/ReadingCarousel';
import { ProgressBar } from '@/components/shared/ProgressBar';

const STOP_LOCK_SEC = 120; // focus-mode accidental-abort / commitment guard
const REVEAL_MS = 4000;
const TICK_MS = 250;

type Phase = 'ready' | 'running';

export default function SessionTracker() {
  const { userBookId } = useLocalSearchParams<{ userBookId: string }>();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const startSession = useSessionStore((s) => s.startSession);
  const setResult = useSessionStore((s) => s.setResult);

  // Currently-reading shelf for the picker; selection drives which book starts.
  const [readingBooks, setReadingBooks] = useState<UserBook[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialIndex, setInitialIndex] = useState(0);
  const didCenter = useRef(false);
  const prevLenRef = useRef(0);

  // The book the session actually runs with — frozen at start so the running
  // phase is immune to any later selection/refetch.
  const [sessionBook, setSessionBook] = useState<UserBook | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [focusMode, setFocusMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedWhole, setElapsedWhole] = useState(0); // whole seconds, drives the focus-lock only
  const [showEndEntry, setShowEndEntry] = useState(false);
  const [endPage, setEndPage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedBook =
    readingBooks && selectedIndex < readingBooks.length ? readingBooks[selectedIndex] : null;

  // --- clock state (JS refs; wall-clock based so it can never drift or stall) ---
  const startedAtRef = useRef(0);
  const pausedAccumRef = useRef(0); // total ms spent in completed pauses
  const pauseStartRef = useRef<number | null>(null); // ms-epoch the current pause began, or null

  // The only value the UI reads. Written from a 250ms interval (no re-render),
  // formatted on the UI thread by SessionTimer via animatedProps.
  const elapsedSec = useSharedValue(0);

  const computeElapsedMs = useCallback(() => {
    const base = pauseStartRef.current ?? Date.now();
    return Math.max(0, base - startedAtRef.current - pausedAccumRef.current);
  }, []);

  // --- drive the clock while running ---
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      elapsedSec.value = computeElapsedMs() / 1000;
    };
    tick(); // paint 0:00 immediately
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [phase, computeElapsedMs, elapsedSec]);

  // --- focus-mode stop-lock countdown (1s tick, only while it matters) ---
  useEffect(() => {
    if (phase !== 'running' || !focusMode || elapsedWhole >= STOP_LOCK_SEC) return;
    const id = setInterval(() => {
      if (!paused) setElapsedWhole((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, focusMode, elapsedWhole, paused]);

  // --- load the currently-reading shelf (does NOT start the session) ---
  // Refetches on focus so a book added via the "add to current reads" flow shows
  // up on return. Skipped while running so an in-flight session is never touched.
  useFocusEffect(
    useCallback(() => {
      if (phase === 'running') return;
      let alive = true;
      (async () => {
        const reading = await api.getUserBooks('reading');
        let list = reading;
        if (!reading.some((b) => b.id === userBookId)) {
          const pb = await api.getUserBook(userBookId);
          if (pb && !reading.some((b) => b.id === pb.id)) list = [pb, ...reading];
        }
        if (!alive) return;
        setReadingBooks(list);
        if (!didCenter.current) {
          const idx = Math.max(0, list.findIndex((b) => b.id === userBookId));
          setSelectedIndex(idx);
          setInitialIndex(idx);
          didCenter.current = true;
        } else if (list.length > prevLenRef.current) {
          // A book was just added to current reads (newest is unshifted to the
          // front) — focus it so the user can start straight away.
          setSelectedIndex(0);
          setInitialIndex(0);
        } else {
          setSelectedIndex((prev) => Math.min(prev, list.length));
        }
        prevLenRef.current = list.length;
      })();
      return () => {
        alive = false;
      };
    }, [api, userBookId, phase])
  );

  // --- reveal-on-tap (invisible UI) ---
  const detailsOpacity = useSharedValue(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealDetails = useCallback(() => {
    detailsOpacity.value = withTiming(1, { duration: 180 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      detailsOpacity.value = withTiming(0, { duration: 400 });
    }, REVEAL_MS);
  }, [detailsOpacity]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const detailsStyle = useAnimatedStyle(() => ({ opacity: detailsOpacity.value }));

  const beginSession = () => {
    const b = selectedBook;
    if (!b) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSessionBook(b);
    startedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    pauseStartRef.current = null;
    elapsedSec.value = 0;
    startSession({
      userBookId: b.id,
      bookId: b.book.id,
      bookTitle: b.book.title,
      coverUrl: b.book.coverUrl,
      format: b.format,
      startedAtMs: startedAtRef.current,
      startPage: b.currentPage,
      pageCount: b.book.pageCount,
    });
    setPhase('running');
    revealDetails();
  };

  const togglePause = () => {
    if (paused) {
      if (pauseStartRef.current != null) {
        pausedAccumRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      setPaused(false);
    } else {
      pauseStartRef.current = Date.now();
      setPaused(true);
    }
  };

  const beginFinish = () => {
    setEndPage(String(sessionBook?.currentPage ?? ''));
    setShowEndEntry(true);
  };

  const confirmFinish = async () => {
    if (!sessionBook) return;
    setSubmitting(true);
    const elapsedMs = computeElapsedMs();
    const start = sessionBook.currentPage;
    const end = Math.max(start, parseInt(endPage, 10) || start);
    try {
      const result = await api.completeSession({
        clientUuid: uuidv4(),
        userBookId: sessionBook.id,
        bookId: sessionBook.book.id,
        format: sessionBook.format,
        startedAt: new Date(startedAtRef.current).toISOString(),
        endedAt: new Date(startedAtRef.current + elapsedMs).toISOString(),
        startPage: sessionBook.format === 'audiobook' ? null : start,
        endPage: sessionBook.format === 'audiobook' ? null : end,
        minutesListened: sessionBook.format === 'audiobook' ? Math.round(elapsedMs / 60000) : null,
        endPositionMin: null,
        localDate: localDateString(),
        source: 'live',
        enqueuedAt: Date.now(),
        attempts: 0,
      });
      setResult(result);
      track('session_completed', {
        format: sessionBook.format,
        pagesRead: result.pagesRead,
        durationSeconds: result.durationSeconds,
        isPersonalBest: result.isPersonalBest,
        xpGained: result.xpGained,
        source: 'live',
      });
      // Keep `active` set so the celebration + share card can read the book
      // title/cover; the celebration's Done action clears it.
      router.replace('/(modals)/session-complete' as Href);
    } finally {
      setSubmitting(false);
    }
  };

  const goAddReading = () => router.push('/(modals)/add-book?status=reading' as Href);

  if (!readingBooks) {
    return (
      <View style={[styles.loading, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  // ── Confirmation screen — pick the book, then start ─────────────────────────
  if (phase === 'ready') {
    const isAudio = selectedBook?.format === 'audiobook';
    const Body = reduce ? View : Animated.View;
    return (
      <View style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={[styles.readyTopBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close without starting"
            style={[styles.closeBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="close" size={22} color={t.text} />
          </Pressable>
        </View>

        <Body {...(reduce ? {} : { entering: FadeIn.duration(ANIMATION.durationNormal) })} style={styles.readyBody}>
          <Text style={[styles.pickLabel, { color: t.textSec }]}>
            {readingBooks.length > 1 ? 'WHAT ARE YOU READING?' : 'TONIGHT’S READ'}
          </Text>

          <ReadingCarousel
            books={readingBooks}
            initialIndex={initialIndex}
            onSelect={setSelectedIndex}
            onAddPress={goAddReading}
          />

          <View style={styles.readyText}>
            {selectedBook ? (
              <>
                <Text style={[styles.readyTitle, { color: t.text }]} numberOfLines={2}>
                  {selectedBook.book.title}
                </Text>
                <Text style={[styles.readyAuthor, { color: t.textSec }]} numberOfLines={1}>
                  {selectedBook.book.authors.join(', ')}
                </Text>
                <Text style={[styles.readyStartPage, { color: t.textTer }]}>
                  {isAudio ? 'Picking up where you left off' : `Starting on page ${selectedBook.currentPage}`}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.readyTitle, { color: t.text }]}>Add a book</Text>
                <Text style={[styles.readyAuthor, { color: t.textSec }]}>
                  Put a book on your current reads to track a session.
                </Text>
              </>
            )}
          </View>
        </Body>

        <View style={[styles.readyFooter, { paddingBottom: insets.bottom + 20 }]}>
          {selectedBook ? (
            <>
              <Pressable
                onPress={() => setFocusMode((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: focusMode }}
                accessibilityLabel="Focus mode"
                style={[styles.focusRow, { backgroundColor: t.bgSec, borderColor: focusMode ? t.accent : t.border }]}
              >
                <View style={[styles.focusIcon, { backgroundColor: t.accentMuted }]}>
                  <Ionicons name="lock-closed" size={16} color={t.accent} />
                </View>
                <View style={styles.focusTextWrap}>
                  <Text style={[styles.focusTitle, { color: t.text }]}>Focus mode</Text>
                  <Text style={[styles.focusSub, { color: t.textSec }]}>
                    Locks Finish for the first 2 minutes so you don’t bail early.
                  </Text>
                </View>
                <Switch
                  value={focusMode}
                  onValueChange={setFocusMode}
                  trackColor={{ false: t.bgTer, true: t.accent }}
                  thumbColor={PALETTE.text}
                  ios_backgroundColor={t.bgTer}
                />
              </Pressable>

              <ConfirmButton label="Start reading" icon="play" onPress={beginSession} />
              <Text style={[styles.readyHint, { color: t.textTer }]}>The timer starts the moment you tap.</Text>
            </>
          ) : (
            <ConfirmButton label="Add a book" icon="add" onPress={goAddReading} />
          )}
        </View>
      </View>
    );
  }

  // ── Running tracker (invisible UI) ──────────────────────────────────────────
  const book = sessionBook;
  if (!book) {
    return (
      <View style={[styles.loading, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  const isAudio = book.format === 'audiobook';
  const canStop = focusMode ? elapsedWhole >= STOP_LOCK_SEC && !paused : !paused;
  const stopUnlocksInSec = Math.max(0, STOP_LOCK_SEC - elapsedWhole);

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: t.bg }]}
      entering={reduce ? undefined : FadeIn.duration(ANIMATION.durationNormal)}
    >
      {/* Tap surface toggles detail reveal */}
      <Pressable style={styles.tapSurface} onPress={revealDetails} accessibilityRole="none">
        <View style={styles.center}>
          {/* Revealed context */}
          <Animated.View style={[styles.details, detailsStyle]}>
            <Text style={[styles.bookTitle, { color: t.text }]} numberOfLines={1}>
              {book.book.title}
            </Text>
            <Text style={[styles.readingLabel, { color: t.accent }]}>
              {paused ? 'Paused' : isAudio ? 'Listening' : 'Reading'}
            </Text>
          </Animated.View>

          {/* The clock */}
          <SessionTimer elapsedSec={elapsedSec} style={{ color: t.text }} />

          {/* Page progress (revealed) */}
          {!isAudio ? (
            <Animated.View style={[styles.progressWrap, detailsStyle]}>
              <ProgressBar
                value={book.currentPage}
                max={book.book.pageCount ?? 1}
                height={6}
                animateOnMount={false}
              />
              <Text style={[styles.startedOn, { color: t.textTer }]}>
                Started on page {book.currentPage}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <SessionControlBar
          isPaused={paused}
          canStop={canStop}
          stopUnlocksInSec={stopUnlocksInSec}
          onTogglePause={togglePause}
          onStop={beginFinish}
        />
      </View>

      {/* End-page entry overlay */}
      {showEndEntry ? (
        <KeyboardAvoidingView
          style={styles.entryOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.entryBackdrop} onPress={() => !submitting && setShowEndEntry(false)} />
          <View style={[styles.entrySheet, { backgroundColor: t.bgSec, paddingBottom: insets.bottom + 20 }]}>
            <Text style={[styles.entryTitle, { color: t.text }]}>
              {isAudio ? 'Where did you stop?' : 'What page are you on?'}
            </Text>
            <Text style={[styles.entryHint, { color: t.textSec }]}>
              You started on page {book.currentPage}. Leave it the same if you didn’t turn a page.
            </Text>
            <TextInput
              value={endPage}
              onChangeText={setEndPage}
              keyboardType="number-pad"
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              maxLength={5}
              style={[styles.entryInput, { color: t.text, borderColor: t.accent }]}
              accessibilityLabel="End page"
            />
            <Pressable
              onPress={confirmFinish}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Finish session"
              style={[styles.entryBtn, { backgroundColor: t.accent }, submitting && styles.btnBusy]}
            >
              {submitting ? (
                <ActivityIndicator color={PALETTE.onAccent} />
              ) : (
                <Text style={styles.entryBtnText}>Finish session</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Animated.View>
  );
}

function ConfirmButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <View style={styles.startBtnWrap}>
      <PressBlock onPress={onPress} accessibilityLabel={label} style={styles.startBtn}>
        <Ionicons name={icon} size={22} color={PALETTE.onAccent} />
        <Text style={styles.startBtnText}>{label.toUpperCase()}</Text>
      </PressBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Ready screen
  readyTopBar: { paddingHorizontal: 20 },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  pickLabel: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.6 },
  readyText: { alignItems: 'center', gap: 6, paddingHorizontal: 32, minHeight: 92 },
  readyTitle: { fontFamily: FONTS.displayBold, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  readyAuthor: { fontFamily: FONTS.uiRegular, fontSize: 15, textAlign: 'center' },
  readyStartPage: { fontFamily: FONTS.uiMedium, fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  readyFooter: { paddingHorizontal: 24, gap: 14, alignItems: 'center' },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: 14,
    borderRadius: 0,
    borderWidth: 1,
  },
  focusIcon: { width: 32, height: 32, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  focusTextWrap: { flex: 1, gap: 2 },
  focusTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  focusSub: { fontFamily: FONTS.uiRegular, fontSize: 12, lineHeight: 16 },
  startBtnWrap: { width: '100%', position: 'relative' },
  startGlow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 10,
    bottom: -6,
    borderRadius: 0,
    opacity: 0,
    backgroundColor: PALETTE.accent,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK,
    borderColor: INK,
    backgroundColor: PALETTE.accent,
  },
  startBtnText: { fontFamily: FONTS.uiBold, fontSize: 16, letterSpacing: 1, color: PALETTE.onAccent },
  readyHint: { fontFamily: FONTS.uiRegular, fontSize: 12.5 },

  // Running tracker
  tapSurface: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  details: { alignItems: 'center', gap: 6 },
  bookTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 16, maxWidth: 280, textAlign: 'center' },
  readingLabel: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  progressWrap: { width: 220, gap: 8, alignItems: 'center' },
  startedOn: { fontFamily: FONTS.uiMedium, fontSize: 12 },
  controls: { paddingHorizontal: 20 },

  // End-page entry
  entryOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  entryBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: PALETTE.overlay },
  entrySheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 24, gap: 12 },
  entryTitle: { fontFamily: FONTS.uiBold, fontSize: 20 },
  entryHint: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20 },
  entryInput: {
    fontFamily: FONTS.uiBold,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    borderBottomWidth: 2,
    paddingVertical: 8,
    marginVertical: 8,
  },
  entryBtn: { minHeight: 52, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  btnBusy: { opacity: 0.7 },
  entryBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 16, color: PALETTE.onAccent },
});
