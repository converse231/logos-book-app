import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const FRAME = 248;

// ISBN scanner (blueprint Section 3). Live camera via expo-camera; on an EAN-13
// barcode it hands the code to add-book (?q=<isbn>), where searchBooks resolves
// it by ISBN. Catalog search is always available as a fallback. Deep link: logos://scan
export default function Scanner() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false); // fire the lookup exactly once per scan session

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    sweep.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, sweep]);
  const scanLine = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * (FRAME - 24) }] }));

  const onBarcode = ({ data }: { data: string }) => {
    if (handled.current || !data) return;
    const code = data.replace(/[\s-]/g, '');
    // Book covers carry two barcodes — the ISBN (Bookland EAN-13: 978/979…) and a
    // price barcode. Accept only a real ISBN; ignore the rest and keep scanning.
    const isBookIsbn = /^(?:978|979)\d{10}$/.test(code) || /^\d{9}[\dXx]$/.test(code);
    if (!isBookIsbn) return;
    handled.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/(modals)/add-book?q=${encodeURIComponent(code)}` as Href);
  };

  const granted = permission?.granted ?? false;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
          onBarcodeScanned={onBarcode}
        />
      ) : null}
      {/* Dim scrim over the camera so the framing + chrome stay legible. */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Scan a book</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.center}>
        {granted ? (
          <>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.tl, { borderColor: t.accent }]} />
              <View style={[styles.corner, styles.tr, { borderColor: t.accent }]} />
              <View style={[styles.corner, styles.bl, { borderColor: t.accent }]} />
              <View style={[styles.corner, styles.br, { borderColor: t.accent }]} />
              {!reduce ? <Animated.View style={[styles.scanLine, { backgroundColor: t.accent }, scanLine]} /> : null}
            </View>
            <Text style={styles.hint}>Center the barcode on the back cover</Text>
          </>
        ) : (
          <View style={styles.permWrap}>
            <View style={[styles.frame, styles.permIcon]}>
              <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.35)" />
            </View>
            <Text style={styles.hint}>
              {permission?.canAskAgain === false
                ? 'Camera access is off. Enable it in Settings to scan barcodes.'
                : 'Allow camera access to scan a book’s barcode.'}
            </Text>
            {permission?.canAskAgain !== false ? (
              <Pressable
                onPress={() => requestPermission()}
                accessibilityRole="button"
                accessibilityLabel="Allow camera access"
                style={({ pressed }) => [styles.permBtn, { borderColor: t.accent }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="camera" size={18} color={t.accent} />
                <Text style={[styles.permBtnText, { color: t.accent }]}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Search the catalog instead" onPress={() => router.replace('/(modals)/add-book' as Href)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque near-black base; the CameraView (when granted) fills behind everything.
  root: { flex: 1, backgroundColor: '#08090C', paddingHorizontal: 20 },
  scrim: { backgroundColor: 'rgba(8,9,12,0.45)' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 17, color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  permIcon: { backgroundColor: 'rgba(255,255,255,0.05)' },
  corner: { position: 'absolute', width: 34, height: 34 },
  tl: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: { position: 'absolute', top: 12, left: 18, right: 18, height: 2, borderRadius: 0, opacity: 0.85 },
  hint: { fontFamily: FONTS.uiMedium, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 280 },
  permWrap: { alignItems: 'center', gap: 18 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 48,
    borderRadius: 0, borderWidth: 2,
  },
  permBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  actions: {},
});
