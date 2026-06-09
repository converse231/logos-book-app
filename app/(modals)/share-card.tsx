import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { useSessionStore } from '@/stores/sessionStore';
import { CardVariant } from '@/services/types';
import { ShareCardCanvas, CardStats } from '@/components/shared/ShareCardCanvas';
import { PressBlock } from '@/components/shared/PressBlock';

type Mode = 'transparent' | 'dark';
type SaveStatus = 'idle' | 'working' | 'saved' | 'denied' | 'error';

const CAPTURE_WIDTH = 1080; // off-screen render width → crisp 1080×1350 export

const VARIANTS: { key: CardVariant; label: string; enabled: boolean }[] = [
  { key: 'session', label: 'Session', enabled: true },
  { key: 'streak', label: 'Streak', enabled: false },
  { key: 'book_finished', label: 'Finished', enabled: false },
  { key: 'year_in_books', label: 'Year', enabled: false },
];

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
  const { width: screenW } = useWindowDimensions();

  const result = useSessionStore((s) => s.lastResult);
  const active = useSessionStore((s) => s.active);
  const [levelName, setLevelName] = useState('Reader');
  const [mode, setMode] = useState<Mode>('transparent');
  const [variant] = useState<CardVariant>('session');
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Off-screen, full-resolution target that the capture reads from.
  const shotRef = useRef<View>(null);
  const [perm, requestPerm] = MediaLibrary.usePermissions();

  useEffect(() => {
    api.getProfile().then((p) => setLevelName(p.levelName));
  }, [api]);

  // reset transient feedback when the user changes the design
  useEffect(() => {
    setStatus('idle');
  }, [mode, variant]);

  if (!result) {
    return (
      <View style={[styles.fallback, { backgroundColor: t.bg }]}>
        <Text style={[styles.fallbackText, { color: t.textSec }]}>Nothing to share yet.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/home' as Href)}>
          <Text style={[styles.fallbackLink, { color: t.accent }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const minutes = Math.max(1, Math.round(result.durationSeconds / 60));
  const pages = result.pagesRead ?? 0;
  const pph = result.pph ?? Math.round((pages / (result.durationSeconds / 3600)) * 10) / 10;

  const stats: CardStats = {
    headline: String(pages),
    headlineUnit: pages === 1 ? 'page read' : 'pages read',
    sub: [
      { label: 'minutes', value: String(minutes) },
      { label: 'pages/hr', value: String(pph) },
    ],
    bookTitle: active?.bookTitle,
    bookCoverUrl: active?.coverUrl ?? null,
    format: active?.format,
  };

  const previewW = Math.min(screenW - 80, 300);

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
          ? { url: uri, message: `${levelName} on Logos. Track every word you read.` }
          : { message: `${pages} pages in ${minutes} min · ${levelName} on Logos.\nTrack every word you read.`, url: uri }
      );
    } catch {
      // capture/share failed or user dismissed — fall back to plain text
      try {
        await Share.share({
          message: `${pages} pages in ${minutes} min · ${levelName} on Logos.\nTrack every word you read.`,
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

      {/* Mode toggle */}
      <View style={[styles.toggle, { backgroundColor: t.bgSec, borderColor: t.border }]}>
        <ToggleSeg
          label="Overlay"
          active={mode === 'transparent'}
          onPress={() => setMode('transparent')}
          accent={t.accent}
          textSec={t.textSec}
        />
        <ToggleSeg
          label="Card"
          active={mode === 'dark'}
          onPress={() => setMode('dark')}
          accent={t.accent}
          textSec={t.textSec}
        />
      </View>

      {/* Preview */}
      <View style={styles.previewArea}>
        <View style={[styles.previewBox, { width: previewW + 24 }]}>
          {mode === 'transparent' ? <Checkerboard /> : null}
          <View style={styles.cardWrap}>
            <ShareCardCanvas
              variant={variant}
              mode={mode}
              stats={stats}
              levelName={levelName}
              width={previewW}
            />
          </View>
        </View>
      </View>

      {/* Variant chips */}
      <View style={styles.chips}>
        {VARIANTS.map((v) => (
          <View
            key={v.key}
            style={[
              styles.chip,
              {
                borderColor: v.key === variant ? t.accent : t.border,
                backgroundColor: v.key === variant ? t.accentMuted : 'transparent',
                opacity: v.enabled ? 1 : 0.4,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: v.key === variant ? t.accent : t.textSec }]}>
              {v.label}
            </Text>
          </View>
        ))}
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

      {/* Off-screen full-res capture target (not visible) */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCardCanvas
          ref={shotRef}
          variant={variant}
          mode={mode}
          stats={stats}
          levelName={levelName}
          width={CAPTURE_WIDTH}
        />
      </View>
    </View>
  );
}

function ToggleSeg({
  label,
  active,
  onPress,
  accent,
  textSec,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
  textSec: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.seg, active && { backgroundColor: accent }]}
    >
      <Text style={[styles.segText, { color: active ? PALETTE.onAccent : textSec }]}>{label}</Text>
    </Pressable>
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
              style={[styles.checkerCell, { backgroundColor: (r + c) % 2 === 0 ? '#E5E0D2' : '#F4F1E8' }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  fallbackText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  fallbackLink: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontFamily: FONTS.uiBold, fontSize: 22 },
  closeBtn: { width: 40, height: 40, borderRadius: 0, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, padding: 4, borderRadius: 0, borderWidth: BORDER_WIDTH, gap: 4 },
  seg: { flex: 1, minHeight: 44, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewBox: { borderRadius: 0, overflow: 'hidden', padding: 12, alignItems: 'center', justifyContent: 'center' },
  cardWrap: {},
  checker: { ...StyleSheet.absoluteFillObject },
  checkerRow: { flex: 1, flexDirection: 'row' },
  checkerCell: { flex: 1 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  footer: { paddingHorizontal: 24, gap: 12 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54,
    borderRadius: 0, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
  },
  saveText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8, color: PALETTE.onAccent },
  btnBusy: { opacity: 0.7 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH,
  },
  shareText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.5 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', marginTop: 2 },
  offscreen: { position: 'absolute', left: -100000, top: 0 },
});
