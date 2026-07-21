import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
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
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { BookFormat } from '@/services/types';
import { ReviewShareCanvas, ReviewCardStats, ReviewCardLayout } from '@/components/shared/ReviewShareCanvas';
import { PressBlock } from '@/components/shared/PressBlock';

type Mode = 'transparent' | 'dark';
type SaveStatus = 'idle' | 'working' | 'saved' | 'denied' | 'error';

const CAPTURE_WIDTH = 1080;
const CARD_RATIO = 1.25;

// Review share composer. Mirrors the session share-card flow: one canvas, two
// outputs (transparent overlay PNG / dark card), two layouts (with cover / no
// cover). Capture + save require a dev build (not Expo Go).
export default function ShareReview() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ w: 0, h: 0 });

  const p = useLocalSearchParams<{
    rating?: string; body?: string; bookTitle?: string; author?: string;
    cover?: string; reviewer?: string; format?: string;
  }>();

  const mode: Mode = 'transparent'; // overlay only — the dark "Card" option was removed
  const [layout, setLayout] = useState<ReviewCardLayout>('cover');
  const [status, setStatus] = useState<SaveStatus>('idle');

  const shotRef = useRef<View>(null);
  const [perm, requestPerm] = MediaLibrary.usePermissions();

  useEffect(() => { setStatus('idle'); }, [layout]);

  const review: ReviewCardStats = {
    rating: Number(p.rating ?? 0),
    body: p.body ?? '',
    bookTitle: p.bookTitle ?? '',
    author: p.author ?? '',
    coverUrl: p.cover || null,
    reviewerName: p.reviewer || 'A reader',
    format: (p.format as BookFormat) || undefined,
  };

  const previewW = useMemo(() => {
    if (!area.w || !area.h) return 0;
    const byWidth = area.w - 28;
    const byHeight = (area.h - 28) / CARD_RATIO;
    return Math.max(120, Math.min(byWidth, byHeight, 300));
  }, [area]);

  const onPreviewLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const capture = () => captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });

  const saveToPhotos = async () => {
    if (status === 'working') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('working');
    try {
      const granted = perm?.granted ? perm : await requestPerm();
      if (!granted.granted) { setStatus('denied'); return; }
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
    const msg = `${'★'.repeat(Math.round(review.rating))} ${review.bookTitle} — my review on Quire.`;
    try {
      const uri = await capture();
      await Share.share(Platform.OS === 'ios' ? { url: uri, message: msg } : { message: msg, url: uri });
    } catch {
      try { await Share.share({ message: msg }); } catch { /* dismissed */ }
    }
  };

  const statusLine: Record<SaveStatus, string> = {
    idle: mode === 'transparent' ? 'Saves a transparent PNG you can drop over your story.' : 'Saves a 1080×1350 card to your photos.',
    working: 'Saving…',
    saved: 'Saved to Photos.',
    denied: 'Photo access is off. Enable it in Settings to save.',
    error: 'Could not save. Try again.',
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Share your review</Text>
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

      <View style={styles.previewArea} onLayout={onPreviewLayout}>
        {previewW > 0 ? (
          <View style={[styles.previewBox, { width: previewW + 20 }]}>
            {mode === 'transparent' ? <Checkerboard /> : null}
            <ReviewShareCanvas mode={mode} layout={layout} review={review} width={previewW} />
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <SegGroup
          label="STYLE"
          value={layout}
          options={[{ key: 'cover', label: 'With cover' }, { key: 'minimal', label: 'No cover' }]}
          onChange={(v) => setLayout(v as ReviewCardLayout)}
          t={t}
        />
      </View>

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
              <Ionicons name={status === 'saved' ? 'checkmark' : 'download-outline'} size={20} color={PALETTE.onAccent} />
              <Text style={styles.saveText}>{status === 'saved' ? 'SAVED' : 'SAVE TO PHOTOS'}</Text>
            </>
          )}
        </PressBlock>

        <PressBlock
          onPress={onShare}
          haptic="light"
          accessibilityLabel="Share your review"
          style={[styles.shareBtn, { borderColor: t.border, backgroundColor: t.bgSec }]}
        >
          <Ionicons name="share-social-outline" size={18} color={t.text} />
          <Text style={[styles.shareText, { color: t.text }]}>SHARE</Text>
        </PressBlock>

        <Text style={[styles.note, { color: status === 'denied' || status === 'error' ? t.danger : t.textTer }]}>
          {statusLine[status]}
        </Text>
      </View>

      {/* Off-screen full-res capture target */}
      <View style={styles.offscreen} pointerEvents="none">
        <ReviewShareCanvas ref={shotRef} mode={mode} layout={layout} review={review} width={CAPTURE_WIDTH} />
      </View>
    </View>
  );
}

function SegGroup({
  label, value, options, onChange, t,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.segGroup}>
      <Text style={[styles.segGroupLabel, { color: t.textSec }]}>{label}</Text>
      <View style={[styles.segTrack, { backgroundColor: t.bgSec, borderColor: t.border }]}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => { Haptics.selectionAsync(); onChange(o.key); }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segItem, active && { backgroundColor: t.accent }]}
            >
              <Text style={[styles.segItemText, { color: active ? PALETTE.onAccent : t.textSec }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Checkerboard() {
  const cols = 7;
  const rows = 9;
  return (
    <View style={styles.checker} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.checkerRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <View key={c} style={[styles.checkerCell, { backgroundColor: (r + c) % 2 === 0 ? '#E5E0D2' : '#F6EEDF' }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontFamily: FONTS.uiBold, fontSize: 22 },
  closeBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },

  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingVertical: 12, marginTop: 12 },
  previewBox: { borderRadius: 14, overflow: 'hidden', padding: 10, alignItems: 'center', justifyContent: 'center' },
  checker: { ...StyleSheet.absoluteFillObject },
  checkerRow: { flex: 1, flexDirection: 'row' },
  checkerCell: { flex: 1 },

  controls: { paddingHorizontal: 20, paddingTop: 6, gap: 10 },
  segGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segGroupLabel: { width: 92, fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1 },
  segTrack: { flex: 1, flexDirection: 'row', height: 42, padding: 3, gap: 3, borderRadius: 14, borderWidth: BORDER_WIDTH },
  segItem: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segItemText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },

  footer: { paddingHorizontal: 24, paddingTop: 14, gap: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: INK },
  saveText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8, color: PALETTE.onAccent },
  btnBusy: { opacity: 0.7 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 14, borderWidth: BORDER_WIDTH },
  shareText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.5 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', marginTop: 2 },
  offscreen: { position: 'absolute', left: -100000, top: 0 },
});
