import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { CENTER_COLUMN } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const FRAME = 248;

/**
 * A real ISBN carries a check digit, and barcode reads DO come back corrupted —
 * a smudged or curved cover flips a digit and the scanner reports it as a clean
 * success. Validating the checksum turns those into "keep scanning" instead of a
 * confident lookup for a book that doesn't exist.
 */
export function isValidIsbn(raw: string): boolean {
  const c = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(c)) {
    const sum = [...c].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(c)) {
    const sum = [...c].reduce((a, d, i) => a + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

// ISBN scanner (blueprint Section 3). Live camera via expo-camera; on an EAN-13
// barcode it hands the code to add-book (?q=<isbn>), where searchBooks resolves
// the edition and tapping it opens that book's page.
// it by ISBN. Catalog search is always available as a fallback. Deep link: quire://scan
export default function Scanner() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false); // fire the lookup exactly once per scan session
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    sweep.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, sweep]);
  const scanLine = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * (FRAME - 24) }] }));

  const accept = (code: string) => {
    handled.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/(modals)/add-book?q=${encodeURIComponent(code)}` as Href);
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (handled.current || !data) return;
    const code = data.replace(/[\s-]/g, '');
    // Book covers carry two barcodes — the ISBN (Bookland EAN-13: 978/979…) and a
    // price barcode (which starts 5 and is NOT an ISBN). Require the Bookland prefix
    // AND a valid check digit, so a price code or a misread never triggers a lookup.
    const isBookIsbn =
      (/^(?:978|979)\d{10}$/.test(code) || /^\d{9}[\dXx]$/.test(code)) && isValidIsbn(code);
    if (!isBookIsbn) return;
    accept(code);
  };

  const submitTyped = () => {
    const code = typed.replace(/[\s-]/g, '');
    // Same guard as the scanner: a 13-digit code must be Bookland (978/979), so a
    // valid-but-non-book EAN typed by mistake fails here rather than silently
    // returning an empty search.
    const isBook =
      (/^(?:978|979)\d{10}$/.test(code) || /^\d{9}[\dXx]$/.test(code)) && isValidIsbn(code);
    if (!isBook) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "That ISBN doesn't look right",
        'Check the digits under the barcode — an ISBN is 13 digits (or 10 on older books).'
      );
      return;
    }
    Keyboard.dismiss();
    accept(code);
  };

  const granted = permission?.granted ?? false;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="on"
          enableTorch={torch}
          // Bookland EAN-13 is the real one; UPC-A/E appear on older US printings.
          // Deliberately no code128/itf14 — they aren't book codes and each extra
          // symbology gives the decoder more to try per frame.
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'upc_e'] }}
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
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setTorch((v) => !v); }}
          hitSlop={12}
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'}
          style={styles.closeBtn}
        >
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={22} color={torch ? t.accent : '#FFFFFF'} />
        </Pressable>
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
        {typing ? (
          <View style={styles.typeWrap}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="978…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="number-pad"
              returnKeyType="done"
              autoFocus
              maxLength={17}
              onSubmitEditing={submitTyped}
              style={styles.typeInput}
              accessibilityLabel="Type the ISBN"
            />
            <PrimaryButton label="Find this book" onPress={submitTyped} />
          </View>
        ) : (
          <Pressable
            onPress={() => setTyping(true)}
            accessibilityRole="button"
            accessibilityLabel="Type the ISBN instead"
            style={({ pressed }) => [styles.typeLink, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="keypad-outline" size={17} color="#FFFFFF" />
            <Text style={styles.typeLinkText}>Type the ISBN instead</Text>
          </Pressable>
        )}
        <PrimaryButton label="Search the catalog instead" onPress={() => router.replace('/(modals)/add-book' as Href)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque near-black base; the CameraView (when granted) fills behind everything.
  root: { flex: 1, backgroundColor: '#08090C', paddingHorizontal: 20 },
  scrim: { backgroundColor: 'rgba(8,9,12,0.45)' },
  topBar: { ...CENTER_COLUMN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 17, color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 14,
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
  scanLine: { position: 'absolute', top: 12, left: 18, right: 18, height: 2, borderRadius: 14, opacity: 0.85 },
  hint: { fontFamily: FONTS.uiMedium, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 280 },
  permWrap: { alignItems: 'center', gap: 18 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 48,
    borderRadius: 14, borderWidth: 2,
  },
  permBtnText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  actions: { ...CENTER_COLUMN, gap: 12 },
  typeWrap: { gap: 12 },
  typeInput: {
    fontFamily: FONTS.monoBold, fontSize: 22, color: '#FFFFFF', textAlign: 'center',
    letterSpacing: 2, borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 8,
  },
  typeLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  typeLinkText: { fontFamily: FONTS.uiSemiBold, fontSize: 15, color: '#FFFFFF' },
});
