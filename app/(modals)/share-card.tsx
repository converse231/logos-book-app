import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CENTER_COLUMN_FILL } from '@/theme/layout';
import { CardTextColor } from '@/services/cardColors';
import { CardColorPicker } from '@/components/shared/CardColorPicker';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, NO_FONT_PAD } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useSessionStore } from '@/stores/sessionStore';
import { CardVariant } from '@/services/types';
import { ShareCardCanvas, CardStats, CardLayout } from '@/components/shared/ShareCardCanvas';
import { PressBlock } from '@/components/shared/PressBlock';

type Mode = 'transparent' | 'dark';
type SaveStatus = 'idle' | 'working' | 'saved' | 'denied' | 'error';

const CAPTURE_WIDTH = 1080; // off-screen render width → crisp 1080×1350 export
const CARD_RATIO = 1.25;    // 4:5 — keep in sync with ShareCardCanvas

// Share composer (blueprint Section 10/15). Two outputs from one canvas:
//   • Overlay — a transparent, text-only PNG meant to be dropped over the user's
//     own story/photo.
//   • Card — the full dark card with the cover.
// "Save to Photos" rasterises an off-screen 1080×1350 copy via react-native-view-shot
// and writes it to the library with expo-media-library (both require a dev build —
// not available in Expo Go).
export default function ShareCard() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ w: 0, h: 0 });

  const result = useSessionStore((s) => s.lastResult);
  const active = useSessionStore((s) => s.active);
  // Re-share mode: opened from a past session's detail with its stats as params.
  const params = useLocalSearchParams<{
    title?: string; cover?: string; format?: string; pages?: string; minutes?: string; pph?: string;
    streak?: string; pagesTotal?: string; booksTotal?: string;
    // Book-report mode, opened from a finished book's reading report. Leads with
    // the days it took rather than a single session.
    report?: string; days?: string; sessionCount?: string; pace?: string; bookPages?: string;
  }>();
  const isReport = params.report === '1';
  const reshare = params.pages !== undefined;
  // Streak mode: opened from the streak celebration, so the card leads with the
  // streak instead of a session. There's no book behind it — the canvas already
  // falls back to the progress mark when there's no title.
  const streakDays = params.streak ? Number(params.streak) : null;
  const [levelName, setLevelName] = useState('Reader');
  const mode: Mode = 'transparent'; // overlay only — the dark "Card" option was removed
  const [layout, setLayout] = useState<CardLayout>('feature');
  const [variant] = useState<CardVariant>('session');
  const [textColor, setTextColor] = useState<CardTextColor>('white');
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Off-screen, full-resolution target that the capture reads from.
  const shotRef = useRef<View>(null);
  const styleScrollRef = useRef<ScrollView>(null);
  const [perm, requestPerm] = MediaLibrary.usePermissions();

  useEffect(() => {
    api.getProfile().then((p) => setLevelName(p.levelName));
  }, [api]);

  // reset transient feedback when the user changes the design
  useEffect(() => {
    setStatus('idle');
  }, [layout, variant, textColor]);

  // Report mode carries everything it needs in params, so it must be listed
  // here too — without it the screen fell through to "Nothing to share yet"
  // and the Share this read button looked broken.
  if (!result && !reshare && streakDays == null && !isReport) {
    return (
      <View style={[styles.fallback, { backgroundColor: t.bg }]}>
        <Text style={[styles.fallbackText, { color: t.textSec }]}>Nothing to share yet.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/home' as Href)}>
          <Text style={[styles.fallbackLink, { color: t.accent }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  // Stats come from the re-share params (a past session) or the last live result.
  const pages = reshare ? Number(params.pages) : (result?.pagesRead ?? 0);
  const minutes = reshare
    ? Number(params.minutes)
    : Math.max(1, Math.round((result?.durationSeconds ?? 60) / 60));
  const pph = reshare
    ? Number(params.pph)
    : (result?.pph ?? Math.round((pages / ((result?.durationSeconds ?? 3600) / 3600)) * 10) / 10);
  const bookTitle = isReport || reshare ? params.title : active?.bookTitle;
  const bookCoverUrl = isReport || reshare ? (params.cover || null) : (active?.coverUrl ?? null);
  const bookFormat = (isReport || reshare ? params.format : active?.format) as CardStats['format'];

  // Book position — drives the shape of the progress mark on the no-cover cards.
  // Only a live paged session knows it; re-shares and audiobooks don't carry it,
  // and the mark then draws a neutral open book.
  // `active` is whatever session is live right now, which in report mode is a
  // DIFFERENT book to the one being shared — so report mode takes none of it and
  // the canvas draws its neutral mark instead.
  const bookPageCount = reshare || isReport ? null : (active?.pageCount ?? null);
  const bookStartPage = reshare || isReport || active?.startPage == null ? null : active.startPage;
  const bookEndPage = bookStartPage != null ? bookStartPage + pages : null;

  const num = (v?: string) => (v && Number(v) > 0 ? Number(v).toLocaleString() : null);
  const streakSub = [
    num(params.pagesTotal) ? { label: 'pages read', value: num(params.pagesTotal)! } : null,
    num(params.booksTotal) ? { label: 'books', value: num(params.booksTotal)! } : null,
  ].filter(Boolean) as CardStats['sub'];

  const reportSub = [
    { label: 'minutes', value: params.minutes ?? '0' },
    params.sessionCount ? { label: 'sessions', value: params.sessionCount } : null,
    params.pace ? { label: 'pages/hr', value: params.pace } : null,
    !params.pace && params.bookPages ? { label: 'pages', value: params.bookPages } : null,
  ].filter(Boolean).slice(0, 3) as CardStats['sub'];

  const stats: CardStats = isReport
    ? {
        headline: params.days || '—',
        headlineUnit: params.days === '1' ? 'day to finish' : 'days to finish',
        sub: reportSub,
        bookTitle,
        bookCoverUrl,
        format: bookFormat,
      }
    : streakDays != null
    ? {
        headline: String(streakDays),
        headlineUnit: streakDays === 1 ? 'day read' : 'day streak',
        sub: streakSub,
      }
    : {
        headline: String(pages),
        headlineUnit: pages === 1 ? 'page read' : 'pages read',
        sub: [
          { label: 'minutes', value: String(minutes) },
          { label: 'pages/hr', value: String(pph) },
        ],
        bookTitle,
        bookCoverUrl,
        format: bookFormat,
        pageCount: bookPageCount,
        startPage: bookStartPage,
        endPage: bookEndPage,
      };

  // The style carousel — one page per card style. Swiping the preview left/right
  // picks the style (a 4-up segmented control couldn't fit its labels on Android).
  const LAYOUTS: { key: CardLayout; label: string }[] = [
    { key: 'feature', label: 'Feature' },
    { key: 'emblem', label: 'Feature · No cover' },
    { key: 'stats', label: 'Stats' },
    { key: 'statsEmblem', label: 'Stats · No cover' },
  ];
  const idx = Math.max(0, LAYOUTS.findIndex((l) => l.key === layout));

  const onStyleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!area.w) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / area.w);
    const next = LAYOUTS[Math.max(0, Math.min(LAYOUTS.length - 1, i))];
    if (next && next.key !== layout) {
      Haptics.selectionAsync();
      setLayout(next.key);
    }
  };

  const goToStyle = (i: number) => {
    if (!area.w) return;
    styleScrollRef.current?.scrollTo({ x: i * area.w, animated: true });
  };

  // Size the card to fit the measured preview area by BOTH width and height, so it
  // can never overflow into the controls above/below it.
  const previewW = useMemo(() => {
    if (!area.w || !area.h) return 0;
    const byWidth = area.w - 28;
    const byHeight = (area.h - 28) / CARD_RATIO;
    return Math.max(120, Math.min(byWidth, byHeight, 300));
  }, [area]);

  const onPreviewLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const capture = () =>
    captureRef(shotRef, {
      format: 'png', // PNG preserves the alpha channel for overlay mode
      quality: 1,
      result: 'tmpfile',
    });

  const saveToPhotos = async () => {
    if (status === 'working') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('working');
    try {
      const granted = perm?.granted ? perm : await requestPerm();
      if (!granted.granted) {
        setStatus('denied');
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const onShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await capture();
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri, message: `${levelName} on Quire. Track every page you read.` }
          : { message: `${pages} pages in ${minutes} min · ${levelName} on Quire.\nTrack every page you read.`, url: uri }
      );
    } catch {
      // capture/share failed or user dismissed — fall back to plain text
      try {
        await Share.share({
          message: `${pages} pages in ${minutes} min · ${levelName} on Quire.\nTrack every page you read.`,
        });
      } catch {
        // dismissed — no-op
      }
    }
  };

  const statusLine: Record<SaveStatus, string> = {
    idle:
      mode === 'transparent'
        ? 'Saves a transparent PNG you can drop over your story.'
        : 'Saves a 1080×1350 card to your photos.',
    working: 'Saving…',
    saved: 'Saved to Photos.',
    denied: 'Photo access is off. Enable it in Settings to save.',
    error: 'Could not save. Try again.',
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top + 8 }]}>
      {/* Paper bleeds to the edges; the composer is clamped to the centred reading
          column so the preview never balloons on a tablet. */}
      <View style={styles.column}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Share your reading</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.closeBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <Ionicons name="close" size={22} color={t.text} />
        </Pressable>
      </View>

      {/* Preview — a swipeable carousel, one page per style. */}
      <View style={styles.previewArea} onLayout={onPreviewLayout}>
        {previewW > 0 && area.w > 0 ? (
          <ScrollView
            ref={styleScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onStyleScrollEnd}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {LAYOUTS.map((l) => (
              <View key={l.key} style={[styles.page, { width: area.w }]}>
                <View style={[styles.previewBox, { width: previewW + 20 }]}>
                  {mode === 'transparent' ? <Checkerboard /> : null}
                  <View style={styles.cardWrap}>
                    <ShareCardCanvas
                      variant={variant}
                      mode={mode}
                      layout={l.key}
                      stats={stats}
                      levelName={levelName}
                      textColor={textColor}
                      width={previewW}
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* Style indicator — name + dots (tap a dot to jump) */}
      <View style={styles.controls}>
        <Text style={[styles.styleName, { color: t.text }]}>{LAYOUTS[idx]?.label}</Text>
        <View style={styles.dots}>
          {LAYOUTS.map((l, i) => (
            <Pressable
              key={l.key}
              onPress={() => goToStyle(i)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`${l.label} style`}
              accessibilityState={{ selected: i === idx }}
            >
              <View
                style={[
                  styles.dot,
                  i === idx
                    ? { backgroundColor: t.accent, width: 22 }
                    : { backgroundColor: t.textTer, opacity: 0.4 },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.colorWrap}>
        <CardColorPicker value={textColor} onChange={setTextColor} />
      </View>

      {/* Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PressBlock
          onPress={saveToPhotos}
          disabled={status === 'working'}
          accessibilityLabel="Save to Photos"
          style={[styles.saveBtn, { backgroundColor: t.accent }, status === 'working' && styles.btnBusy]}
        >
          {status === 'working' ? (
            <ActivityIndicator color={PALETTE.onAccent} />
          ) : (
            <>
              <Ionicons
                name={status === 'saved' ? 'checkmark' : 'download-outline'}
                size={20}
                color={PALETTE.onAccent}
              />
              <Text style={styles.saveText}>{status === 'saved' ? 'SAVED' : 'SAVE TO PHOTOS'}</Text>
            </>
          )}
        </PressBlock>

        <PressBlock
          onPress={onShare}
          haptic="light"
          accessibilityLabel="Share your reading card"
          style={[styles.shareBtn, { borderColor: t.border, backgroundColor: t.bgSec }]}
        >
          <Ionicons name="share-social-outline" size={18} color={t.text} />
          <Text style={[styles.shareText, { color: t.text }]}>SHARE</Text>
        </PressBlock>

        <Text
          style={[
            styles.note,
            { color: status === 'denied' || status === 'error' ? t.danger : t.textTer },
          ]}
        >
          {statusLine[status]}
        </Text>
      </View>

      </View>

      {/* Off-screen full-res capture target (not visible). Deliberately OUTSIDE the
          clamped column — it must not inherit the column's maxWidth. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCardCanvas
          ref={shotRef}
          variant={variant}
          mode={mode}
          layout={layout}
          stats={stats}
          levelName={levelName}
          textColor={textColor}
          width={CAPTURE_WIDTH}
        />
      </View>
    </View>
  );
}

// Lightweight checkerboard so transparency reads in the preview.
function Checkerboard() {
  const cols = 7;
  const rows = 9;
  return (
    <View style={styles.checker} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.checkerRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={[styles.checkerCell, { backgroundColor: (r + c) % 2 === 0 ? '#E5E0D2' : '#F6EEDF' }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: CENTER_COLUMN_FILL,
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  fallbackText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  fallbackLink: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontFamily: FONTS.uiBold, fontSize: 22 },
  closeBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },

  previewArea: { flex: 1, overflow: 'hidden', paddingVertical: 12, marginTop: 12 },
  carousel: { flex: 1 },
  carouselContent: { alignItems: 'center' },
  page: { alignItems: 'center', justifyContent: 'center' },
  previewBox: { borderRadius: 14, overflow: 'hidden', padding: 10, alignItems: 'center', justifyContent: 'center' },
  cardWrap: {},
  checker: { ...StyleSheet.absoluteFillObject },
  checkerRow: { flex: 1, flexDirection: 'row' },
  checkerCell: { flex: 1 },

  controls: { paddingHorizontal: 20, paddingTop: 6, gap: 10, alignItems: 'center' },
  styleName: { fontFamily: FONTS.uiBold, fontSize: 16, ...NO_FONT_PAD },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  colorWrap: { paddingHorizontal: 24, paddingTop: 14 },
  footer: { paddingHorizontal: 24, paddingTop: 14, gap: 12 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
    borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
  },
  saveText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8, color: PALETTE.onAccent },
  btnBusy: { opacity: 0.7 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  shareText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.5 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', marginTop: 2 },
  offscreen: { position: 'absolute', left: -100000, top: 0 },
});
