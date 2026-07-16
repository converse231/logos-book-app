import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { ReadingCarousel } from '@/components/session/ReadingCarousel';
import { PressBlock } from '@/components/shared/PressBlock';
import { LoadingIndicator } from '@/components/shared/LoadingIndicator';
import { localDateString, uuidv4 } from '@/stores/sessionStore';
import { sendOrQueue } from '@/lib/sessionQueue';
import { track } from '@/lib/analytics';

// "I read today" — a streak check-in for when you read but forgot to track. Full
// coverflow picker (same as the session start) titled "What did you read?": the
// centred book is logged as a quick session for today through the atomic
// complete_session RPC (source 'backdated', 0 pages/duration) so the streak counts.
export default function ReadToday() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [books, setBooks] = useState<UserBook[] | null>(null);
  const [alreadyRead, setAlreadyRead] = useState<boolean | null>(null);
  const [index, setIndex] = useState(0);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Already read today? Then the streak is already safe — don't stack a
    // duplicate check-in (repeated taps were the source of phantom 0-page rows).
    api.getHomeData()
      .then((h) => alive && setAlreadyRead(h.streak.lastReadLocalDate === localDateString()))
      .catch(() => alive && setAlreadyRead(false));
    // Prefer current reads; fall back to the whole shelf so any book is loggable.
    api.getUserBooks('reading')
      .then((reading) => (reading.length > 0 ? reading : api.getUserBooks()))
      .then((list) => alive && setBooks(list))
      .catch(() => alive && setBooks([]));
    return () => { alive = false; };
  }, [api]);

  const close = () => router.back();
  const selected = books && index < books.length ? books[index] : null;

  const logReading = async () => {
    if (!selected || logging) return;
    setLogging(true);
    setError(null);
    const iso = new Date().toISOString();
    try {
      // Routed through the offline queue: if there's no connection, the check-in
      // is saved and synced later (keeping the streak), same as a real session.
      const result = await sendOrQueue(api, {
        clientUuid: uuidv4(),
        userBookId: selected.id,
        bookId: selected.book.id,
        format: selected.format,
        startedAt: iso,
        endedAt: iso, // duration 0 — a check-in, not a timed session
        startPage: null,
        endPage: null, // physical/ebook → 0 pages
        minutesListened: selected.format === 'audiobook' ? 0 : null, // audiobook CHECK needs non-null
        endPositionMin: null,
        localDate: localDateString(),
        source: 'backdated',
        enqueuedAt: Date.now(),
        attempts: 0,
      });
      track('read_today', { books: 1 });
      if (result) {
        // Recorded on the server — the streak is updated; Home refreshes on focus.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        close();
      } else {
        // Offline / transient — saved locally, will sync (and update the streak) later.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        close();
        Alert.alert(
          'Saved offline',
          "You're offline, so we saved this check-in. It'll sync and update your streak automatically once you're back online.",
        );
      }
    } catch (e: any) {
      setLogging(false);
      setError(e?.message ?? 'Could not log your reading. Please try again.');
    }
  };

  return (
    <ScreenBackground>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.topBar}>
          <View style={[styles.tag, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
            <Ionicons name="flame" size={13} color={t.accent} />
            <Text style={[styles.tagText, { color: t.accent }]}>I READ TODAY</Text>
          </View>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={[styles.closeBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Ionicons name="close" size={22} color={t.text} />
          </Pressable>
        </View>

        {books === null || alreadyRead === null ? (
          <View style={styles.center}><LoadingIndicator /></View>
        ) : alreadyRead ? (
          <View style={styles.center}>
            <View style={[styles.doneIcon, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
              <Ionicons name="checkmark" size={34} color={t.accent} />
            </View>
            <Text style={[styles.title, { color: t.text }]}>You’ve already read today</Text>
            <Text style={[styles.subtitle, { color: t.textSec }]}>Your streak is safe — see you tomorrow.</Text>
            <PressBlock onPress={close} accessibilityLabel="Done" containerStyle={styles.emptyBtnWrap} style={[styles.logBtn, { backgroundColor: t.accent }]}>
              <Text style={styles.logBtnText}>DONE</Text>
            </PressBlock>
          </View>
        ) : books.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.title, { color: t.text }]}>No books yet</Text>
            <Text style={[styles.subtitle, { color: t.textSec }]}>Add a book first, then you can log your reading.</Text>
            <PressBlock onPress={() => router.replace('/(modals)/add-book' as Href)} accessibilityLabel="Add a book" containerStyle={styles.emptyBtnWrap} style={[styles.logBtn, { backgroundColor: t.accent }]}>
              <Ionicons name="add" size={18} color={t.onAccent} />
              <Text style={styles.logBtnText}>ADD A BOOK</Text>
            </PressBlock>
          </View>
        ) : (
          <>
            <View style={styles.heading}>
              <Text style={[styles.title, { color: t.text }]}>What did you read?</Text>
              <Text style={[styles.subtitle, { color: t.textSec }]}>Pick the book you read to keep your streak going.</Text>
            </View>

            <View style={styles.carouselArea}>
              <ReadingCarousel
                books={books}
                initialIndex={0}
                onSelect={setIndex}
                onAddPress={() => router.replace('/(modals)/add-book?status=reading' as Href)}
              />
              <View style={styles.selectedLabel}>
                {selected ? (
                  <>
                    <Text style={[styles.selTitle, { color: t.text }]} numberOfLines={2}>{selected.book.title}</Text>
                    <Text style={[styles.selAuthor, { color: t.textSec }]} numberOfLines={1}>{selected.book.authors.join(', ')}</Text>
                  </>
                ) : (
                  <Text style={[styles.selAuthor, { color: t.textTer }]}>Swipe back to a book to log it</Text>
                )}
              </View>
            </View>

            <View style={styles.footer}>
              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: t.bgSec, borderColor: t.danger }]}>
                  <Ionicons name="alert-circle" size={18} color={t.danger} />
                  <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
                </View>
              ) : null}
              <PressBlock
                onPress={logReading}
                disabled={!selected || logging}
                accessibilityLabel="Log this read"
                style={[styles.logBtn, { backgroundColor: selected ? t.accent : t.bgTer }]}
              >
                <Ionicons name="flame" size={18} color={selected ? t.onAccent : t.textTer} />
                <Text style={[styles.logBtnText, { color: selected ? '#FFFFFF' : t.textTer }]}>
                  {logging ? 'LOGGING…' : 'LOG THIS READ'}
                </Text>
              </PressBlock>
            </View>
          </>
        )}
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 14, borderWidth: BORDER_WIDTH },
  tagText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.5 },
  closeBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  doneIcon: { width: 72, height: 72, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heading: { alignItems: 'center', gap: 6, marginTop: 24 },
  title: { fontFamily: FONTS.displayBold, fontSize: 28, lineHeight: 32, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 },

  carouselArea: { flex: 1, justifyContent: 'center', gap: 12 },
  selectedLabel: { alignItems: 'center', gap: 3, minHeight: 48, paddingHorizontal: 16 },
  selTitle: { fontFamily: FONTS.displayBold, fontSize: 19, lineHeight: 23, textAlign: 'center' },
  selAuthor: { fontFamily: FONTS.mono, fontSize: 13, textAlign: 'center' },

  footer: { gap: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK },
  errorText: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 13, lineHeight: 18 },
  emptyBtnWrap: { marginTop: 8 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, paddingHorizontal: 20, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: '#241E19' },
  logBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: '#FFFFFF' },
});
