import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { BookCover } from '@/components/shared/BookCover';
import { PressBlock } from '@/components/shared/PressBlock';
import { SwipeDeck, type DeckCard } from '@/components/discover/SwipeDeck';
import { track } from '@/lib/analytics';

const MOODS = ['Cozy', 'Mind-bending', 'Fast-paced', 'Light & funny', 'Epic', 'Dark', 'Hopeful', 'Romantic'];
const BROWSE_CONTEXT = 'Surprise me — recommend based on my overall taste and reading history.';

// Normalized "title|author" key (drops subtitles after ':', collapses whitespace,
// first author only) — used to filter out books already on the user's shelves.
const bookKey = (title: string, author: string) => {
  const t = title.toLowerCase().split(':')[0].replace(/\s+/g, ' ').trim();
  const a = (author ?? '').toLowerCase().split(',')[0].replace(/\s+/g, ' ').trim();
  return `${t}|${a}`;
};

type Phase = 'setup' | 'loading' | 'deck';

// Mood Reader (B6) — describe a vibe or just browse, then swipe through AI picks.
// Right = wishlist (TBR), left = pass, tap = preview. Server returns 10/req
// (token-cheap, 7-day cached); covers/synopsis resolved from the catalog.
export default function Discover() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('setup');
  const [mood, setMood] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wishCount, setWishCount] = useState(0);
  const [preview, setPreview] = useState<DeckCard | null>(null);

  const generate = async (browse: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const moodArg = browse ? '' : (mood ?? context.trim());
    const contextArg = browse ? BROWSE_CONTEXT : context.trim();
    setPhase('loading');
    setError(null);
    setWishCount(0);
    track('mood_reader_used', { mode: browse ? 'browse' : 'mood' });
    try {
      // Pull recs + the user's current shelves together; drop anything they already own.
      const [result, owned] = await Promise.all([api.aiRecommend(moodArg, contextArg), api.getUserBooks()]);
      const ownedKeys = new Set(owned.map((ub) => bookKey(ub.book.title, ub.book.authors?.[0] ?? '')));
      const freshRecs = result.recs.filter((r) => !ownedKeys.has(bookKey(r.title, r.author)));
      if (freshRecs.length === 0) {
        setError(result.recs.length === 0 ? 'No picks this time — try another mood.' : 'You already own these — try another mood.');
        setPhase('setup');
        return;
      }
      // Resolve covers + synopsis from the catalog (parallel; null-safe per item).
      const books = await Promise.all(
        freshRecs.map(async (rec) => {
          try {
            const hits = await api.searchBooks(`${rec.title} ${rec.author}`);
            return hits[0] ?? null;
          } catch {
            return null;
          }
        })
      );
      setCards(freshRecs.map((rec, i) => ({ rec, book: books[i] })));
      setPhase('deck');
    } catch (e: any) {
      setError(e?.message ?? 'Could not get recommendations. Please try again.');
      setPhase('setup');
    }
  };

  const addToWishlist = async (card: DeckCard) => {
    if (!card.book) {
      router.push(`/(modals)/add-book?q=${encodeURIComponent(`${card.rec.title} ${card.rec.author}`)}` as Href);
      return;
    }
    try {
      await api.addBook(card.book, 'physical'); // status defaults to 'want' = wishlist
      track('book_added', { source: 'mood_reader' });
      setWishCount((c) => c + 1);
    } catch {
      setError('Could not add that to your wishlist — check your connection.');
    }
  };

  const onSwipe = (card: DeckCard, dir: 'left' | 'right') => {
    if (dir === 'right') addToWishlist(card);
  };

  // ── Deck phase ──────────────────────────────────────────────────────────────
  if (phase === 'deck') {
    return (
      <ScreenBackground>
        <View style={[styles.deckRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.deckBar}>
            <Pressable
              onPress={() => setPhase('setup')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to moods"
              style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
            >
              <Ionicons name="chevron-back" size={22} color={t.text} />
            </Pressable>
            <View style={[styles.wishPill, { backgroundColor: t.bgSec, borderColor: t.border }]}>
              <Ionicons name="heart" size={14} color={t.accent} />
              <Text style={[styles.wishPillText, { color: t.text }]}>{wishCount} WANTED</Text>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: t.bgSec, borderColor: t.danger }]}>
              <Ionicons name="alert-circle" size={18} color={t.danger} />
              <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
            </View>
          ) : null}

          <SwipeDeck
            cards={cards}
            onSwipe={onSwipe}
            onTap={(card) => { Haptics.selectionAsync(); setPreview(card); }}
            onMore={() => setPhase('setup')}
          />
        </View>

        <PreviewSheet
          card={preview}
          onClose={() => setPreview(null)}
          onWishlist={(card) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); addToWishlist(card); setPreview(null); }}
        />
      </ScreenBackground>
    );
  }

  // ── Setup + loading phase ─────────────────────────────────────────────────────
  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.aiTag, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
            <Ionicons name="sparkles" size={13} color={t.accent} />
            <Text style={[styles.aiTagText, { color: t.accent }]}>MOOD READER</Text>
          </View>

          <Text style={[styles.title, { color: t.text }]}>What are you{'\n'}in the mood for?</Text>
          <Text style={[styles.subtitle, { color: t.textSec }]}>
            Pick a vibe and swipe through picks — right to Want, left to pass. Or just browse your taste.
          </Text>

          {phase === 'loading' ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={t.accent} size="large" />
              <Text style={[styles.loadingText, { color: t.textSec }]}>Finding books for you…</Text>
            </View>
          ) : (
            <>
              <View style={styles.chips}>
                {MOODS.map((mo) => {
                  const active = mood === mo;
                  return (
                    <Pressable
                      key={mo}
                      onPress={() => { Haptics.selectionAsync(); setMood(active ? null : mo); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : t.bgSec }]}
                    >
                      <Text style={[styles.chipText, { color: active ? t.accent : t.text }]}>{mo}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={context}
                onChangeText={setContext}
                placeholder="e.g. a short, twisty thriller for a flight"
                placeholderTextColor={t.textTer}
                multiline
                accessibilityLabel="Describe what you want to read"
                style={[styles.input, { backgroundColor: t.bgSec, color: t.text, borderColor: t.border }]}
              />

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: t.bgSec, borderColor: t.danger }]}>
                  <Ionicons name="alert-circle" size={18} color={t.danger} />
                  <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
                </View>
              ) : null}

              <PressBlock
                onPress={() => generate(false)}
                disabled={!mood && context.trim().length === 0}
                accessibilityLabel="Get picks for this mood"
                containerStyle={styles.cta}
                style={[styles.ctaInner, { backgroundColor: (mood || context.trim()) ? t.accent : t.bgTer }]}
              >
                <Ionicons name="sparkles" size={18} color={(mood || context.trim()) ? t.onAccent : t.textTer} />
                <Text style={[styles.ctaText, { color: (mood || context.trim()) ? t.onAccent : t.textTer }]}>GET MY PICKS</Text>
              </PressBlock>

              <Pressable
                onPress={() => generate(true)}
                accessibilityRole="button"
                accessibilityLabel="Just browse based on my taste"
                style={({ pressed }) => [styles.browseBtn, { borderColor: t.border }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="shuffle" size={18} color={t.text} />
                <Text style={[styles.browseText, { color: t.text }]}>Just browse my taste</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

// Tap-a-card preview — read the synopsis + the AI's reasoning before deciding,
// so you're not judging by the cover. Wishlist from here without it counting as a swipe.
function PreviewSheet({
  card,
  onClose,
  onWishlist,
}: {
  card: DeckCard | null;
  onClose: () => void;
  onWishlist: (card: DeckCard) => void;
}) {
  const t = useTheme();
  if (!card) return null;
  const b = card.book;
  const meta = [b?.publishedYear ? String(b.publishedYear) : null, b?.pageCount ? `${b.pageCount} pages` : null, b?.genres?.[0] ?? null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable style={[styles.sheet, { backgroundColor: t.bg, borderColor: t.border }]} onPress={() => {}}>
          <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
            <View style={styles.sheetHead}>
              <View style={[styles.coverFrame, { borderColor: t.border }]}>
                <BookCover url={b?.coverUrl ?? null} title={card.rec.title} width={96} />
              </View>
              <View style={styles.sheetHeadText}>
                <Text style={[styles.sheetTitle, { color: t.text }]}>{card.rec.title}</Text>
                <Text style={[styles.sheetAuthor, { color: t.textSec }]}>{card.rec.author}</Text>
                {meta ? <Text style={[styles.sheetMeta, { color: t.textTer }]}>{meta}</Text> : null}
              </View>
            </View>

            <View style={[styles.whyBlock, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
              <Text style={[styles.whyLabel, { color: t.accent }]}>WHY THIS</Text>
              <Text style={[styles.whyText, { color: t.text }]}>{card.rec.why}</Text>
            </View>

            {b?.description ? (
              <Text style={[styles.descText, { color: t.textSec }]}>{b.description}</Text>
            ) : (
              <Text style={[styles.descText, { color: t.textTer }]}>No synopsis available for this edition.</Text>
            )}
          </ScrollView>

          <View style={[styles.sheetActions, { borderTopColor: t.border }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.sheetCloseBtn, { borderColor: t.border }]}
            >
              <Text style={[styles.sheetCloseText, { color: t.text }]}>CLOSE</Text>
            </Pressable>
            <PressBlock
              onPress={() => onWishlist(card)}
              accessibilityLabel="Add to Want shelf"
              containerStyle={styles.sheetAddWrap}
              style={[styles.sheetAddBtn, { backgroundColor: t.accent }]}
            >
              <Ionicons name="heart" size={18} color={t.onAccent} />
              <Text style={styles.sheetAddText}>WANT</Text>
            </PressBlock>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 0, borderWidth: BORDER_WIDTH, alignSelf: 'flex-start' },
  aiTagText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.5 },
  title: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21, marginTop: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 42, borderRadius: 0, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  input: { minHeight: 80, borderRadius: 0, borderWidth: BORDER_WIDTH, padding: 14, fontFamily: FONTS.uiMedium, fontSize: 16, textAlignVertical: 'top' },
  cta: { marginTop: 2 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, borderColor: '#141414' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1 },
  browseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 0, borderWidth: BORDER_WIDTH },
  browseText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 60 },
  loadingText: { fontFamily: FONTS.uiMedium, fontSize: 15 },

  // Deck phase
  deckRoot: { flex: 1, paddingHorizontal: 20 },
  deckBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  wishPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 0, borderWidth: BORDER_WIDTH },
  wishPillText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, marginTop: 12 },
  errorText: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 13, lineHeight: 18 },

  // Preview sheet
  sheetScrim: { flex: 1, backgroundColor: 'rgba(3,4,6,0.62)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopWidth: BORDER_WIDTH_THICK, borderLeftWidth: BORDER_WIDTH_THICK, borderRightWidth: BORDER_WIDTH_THICK, borderRadius: 0, paddingTop: 10 },
  sheetHandle: { width: 44, height: 5, borderRadius: 0, alignSelf: 'center', marginBottom: 14 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  sheetHead: { flexDirection: 'row', gap: 14 },
  coverFrame: { borderWidth: BORDER_WIDTH, borderRadius: 0 },
  sheetHeadText: { flex: 1, gap: 4, justifyContent: 'center' },
  sheetTitle: { fontFamily: FONTS.displayBold, fontSize: 22, lineHeight: 26 },
  sheetAuthor: { fontFamily: FONTS.mono, fontSize: 13 },
  sheetMeta: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.4, marginTop: 2 },
  whyBlock: { borderRadius: 0, borderWidth: BORDER_WIDTH, padding: 14, gap: 4 },
  whyLabel: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.5 },
  whyText: { fontFamily: FONTS.uiMedium, fontSize: 15, lineHeight: 21 },
  descText: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 21 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: BORDER_WIDTH },
  sheetCloseBtn: { flex: 1, height: 52, borderRadius: 0, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
  sheetAddWrap: { flex: 1 },
  sheetAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, borderColor: '#141414' },
  sheetAddText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1, color: '#FFFFFF' },
});
