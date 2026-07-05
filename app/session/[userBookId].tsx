import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ANIMATION, FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { UserBook } from '@/services/types';
import { localDateString, useSessionStore, uuidv4 } from '@/stores/sessionStore';
import { track } from '@/lib/analytics';
import { startReadingActivity, updateReadingActivity, endReadingActivity } from '@/lib/liveActivity';
import { sendOrQueue } from '@/lib/sessionQueue';
import { PressBlock } from '@/components/shared/PressBlock';
import { LoadingIndicator } from '@/components/shared/LoadingIndicator';
import { SessionTimer } from '@/components/session/SessionTimer';
import { SessionControlBar } from '@/components/session/SessionControlBar';
import { ReadingCarousel } from '@/components/session/ReadingCarousel';
import { ProgressBar } from '@/components/shared/ProgressBar';

const STOP_LOCK_SEC = 120; // focus-mode accidental-abort / commitment guard
const CANCEL_WINDOW_SEC = 60; // opening window to drop a mis-started session (never recorded)
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
  const endSession = useSessionStore((s) => s.endSession);

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
  // Correct the starting page (e.g. you read ahead without tracking). null = use
  // the book's stored currentPage. Reset whenever the picker selection changes.
  const [startOverride, setStartOverride] = useState<number | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [startInput, setStartInput] = useState('');

  const selectedBook =
    readingBooks && selectedIndex < readingBooks.length ? readingBooks[selectedIndex] : null;

  // Changing the picked book drops any start-page edit (it belonged to the old book).
  useEffect(() => {
    setStartOverride(null);
    setEditingStart(false);
  }, [selectedIndex]);

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

  // --- whole-second counter for the opening window (1s tick, only while it
  //     matters). Drives the cancel affordance (first 60s) and the focus-mode
  //     finish-lock (first 120s). Ticks only while actively reading (not paused);
  //     stops once past the longer of the two windows. ---
  useEffect(() => {
    if (phase !== 'running' || elapsedWhole >= STOP_LOCK_SEC) return;
    const id = setInterval(() => {
      if (!paused) setElapsedWhole((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, elapsedWhole, paused]);

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

  // Safety net: clear any live activity if the tracker unmounts (idempotent).
  useEffect(() => () => { endReadingActivity(); }, []);

  const detailsStyle = useAnimatedStyle(() => ({ opacity: detailsOpacity.value }));

  // Persist a corrected starting page (you read ahead without tracking). Clamped
  // to the book length; saved so it sticks even if you don't start the session.
  const beginEditStart = () => {
    Haptics.selectionAsync();
    setStartInput(String(startOverride ?? selectedBook?.currentPage ?? 0));
    setEditingStart(true);
  };
  const confirmEditStart = () => {
    if (!selectedBook) return;
    const max = selectedBook.book.pageCount ?? null;
    let n = parseInt(startInput, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (max && max > 0) n = Math.min(n, max);
    setStartOverride(n);
    setEditingStart(false);
    api.updateCurrentPage(selectedBook.id, n).catch(() => {}); // best-effort persist
  };

  const beginSession = () => {
    const b = selectedBook;
    if (!b) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const start = startOverride ?? b.currentPage;
    // Freeze the running book at the (possibly corrected) start page so progress
    // and the finish calc both use it.
    setSessionBook({ ...b, currentPage: start });
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
      startPage: start,
      pageCount: b.book.pageCount,
    });
    setPhase('running');
    // Live activity (lock screen / Dynamic Island) — no-op until the dev build.
    startReadingActivity({
      bookTitle: b.book.title,
      coverUrl: b.book.coverUrl,
      format: b.format,
      startedAtMs: startedAtRef.current,
      startPage: b.currentPage,
      pageCount: b.book.pageCount,
    });
    revealDetails();
  };

  const togglePause = () => {
    if (paused) {
      if (pauseStartRef.current != null) {
        pausedAccumRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      setPaused(false);
      updateReadingActivity({ paused: false });
    } else {
      pauseStartRef.current = Date.now();
      setPaused(true);
      updateReadingActivity({ paused: true });
    }
  };

  const beginFinish = () => {
    setEndPage(String(sessionBook?.currentPage ?? ''));
    setShowEndEntry(true);
  };

  // Drop a just-started session before it's ever recorded. Finish is the only
  // path that calls completeSession, so cancelling simply leaves the tracker —
  // no session row, no streak/XP touched, nothing to reverse.
  const cancelSession = () => {
    Alert.alert(
      'Cancel session?',
      "This session won't be saved and your streak, XP, and progress stay exactly as they were.",
      [
        { text: 'Keep reading', style: 'cancel' },
        {
          text: 'Cancel session',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            endReadingActivity(); // dismiss the lock-screen / Dynamic Island activity
            endSession();
            router.back();
          },
        },
      ]
    );
  };

  const confirmFinish = async () => {
    if (!sessionBook || submitting) return; // guard double-submit (each call = a new session)
    setSubmitting(true);
    const elapsedMs = computeElapsedMs();
    const start = sessionBook.currentPage;
    // Clamp the end page to the book's length (when known) so a fat-fingered
    // number can't over-count pages_read.
    const maxPage = sessionBook.pageCountOverride ?? sessionBook.book.pageCount ?? null;
    let end = Math.max(start, parseInt(endPage, 10) || start);
    if (maxPage && maxPage > 0) end = Math.min(end, maxPage);
    const queued = {
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
      localDate: localDateString(), // frozen at capture — the streak's source of truth
      source: 'live' as const,
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    try {
      // Send now; if offline/transient the session is persisted and synced later.
      const result = await sendOrQueue(api, queued);
      endReadingActivity(); // dismiss the lock-screen activity either way

      if (result) {
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
      } else {
        // Offline / failed — queued. No server result yet, so no celebration;
        // it (and the streak) sync automatically next time we reach the server.
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

  const goAddReading = () => router.push('/(modals)/add-book?status=reading' as Href);

  if (!readingBooks) {
    return (
      <View style={[styles.loading, { backgroundColor: t.bg }]}>
        <LoadingIndicator />
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
                {isAudio ? (
                  <Text style={[styles.readyStartPage, { color: t.textTer }]}>Picking up where you left off</Text>
                ) : (
                  <Pressable
                    onPress={beginEditStart}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Starting on page ${startOverride ?? selectedBook.currentPage}. Tap to change if you read ahead.`}
                    style={[styles.startPageChip, { borderColor: t.border, backgroundColor: t.bgSec }]}
                  >
                    <Text style={[styles.readyStartPage, { color: t.textSec }]}>
                      Starting on page{' '}
                      <Text style={{ color: t.accent, fontFamily: FONTS.uiBold }}>
                        {startOverride ?? selectedBook.currentPage}
                      </Text>
                    </Text>
                    <Ionicons name="pencil" size={13} color={t.accent} />
                  </Pressable>
                )}
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

        {/* Starting-page dialog — a keyboard-aware bottom sheet so the input is
            never hidden behind the keyboard and the prompt can't be missed. */}
        {editingStart && selectedBook ? (
          <KeyboardAvoidingView
            style={styles.entryOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.entryBackdrop} onPress={() => setEditingStart(false)} accessibilityLabel="Dismiss" />
            <View style={[styles.entrySheet, { backgroundColor: t.bgSec, paddingBottom: insets.bottom + 20 }]}>
              <Text style={[styles.entryTitle, { color: t.text }]}>What page are you starting on?</Text>
              <Text style={[styles.entryHint, { color: t.textSec }]}>
                We have you on page {selectedBook.currentPage}. Bump it up if you read ahead without tracking.
              </Text>
              <TextInput
                value={startInput}
                onChangeText={setStartInput}
                keyboardType="number-pad"
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
                maxLength={5}
                onSubmitEditing={confirmEditStart}
                style={[styles.entryInput, { color: t.text, borderColor: t.accent }]}
                accessibilityLabel="Starting page"
              />
              <PressBlock
                onPress={confirmEditStart}
                accessibilityLabel="Set starting page"
                style={[styles.entryBtn, { backgroundColor: t.accent, borderColor: INK }]}
              >
                <Text style={styles.entryBtnText}>Set page</Text>
              </PressBlock>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </View>
    );
  }

  // ── Running tracker (invisible UI) ──────────────────────────────────────────
  const book = sessionBook;
  if (!book) {
    return (
      <View style={[styles.loading, { backgroundColor: t.bg }]}>
        <LoadingIndicator />
      </View>
    );
  }
  const isAudio = book.format === 'audiobook';
  const canStop = focusMode ? elapsedWhole >= STOP_LOCK_SEC && !paused : !paused;
  const stopUnlocksInSec = Math.max(0, STOP_LOCK_SEC - elapsedWhole);
  const canCancel = elapsedWhole < CANCEL_WINDOW_SEC;

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
          showCancel={canCancel}
          onTogglePause={togglePause}
          onStop={beginFinish}
          onCancel={cancelSession}
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
            <PressBlock
              onPress={confirmFinish}
              disabled={submitting}
              accessibilityLabel="Finish session"
              style={[styles.entryBtn, { backgroundColor: t.accent, borderColor: INK }, submitting && styles.btnBusy]}
            >
              {submitting ? (
                <ActivityIndicator color={PALETTE.onAccent} />
              ) : (
                <Text style={styles.entryBtnText}>Finish session</Text>
              )}
            </PressBlock>
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
  readyStartPage: { fontFamily: FONTS.uiMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  startPageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 0, borderWidth: BORDER_WIDTH,
  },
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
  entryBtn: { minHeight: 52, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center' },
  btnBusy: { opacity: 0.7 },
  entryBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 16, color: PALETTE.onAccent },
});
