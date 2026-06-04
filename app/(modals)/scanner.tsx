import { useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const FRAME = 248;

// ISBN scanner (blueprint Section 3). The framing, reticle, and flow live here;
// the live camera + barcode reader land with the dev build (Expo Go can't open
// the native camera module), the same way the share-card capture does. Until
// then, catalog search is the working path. Deep link: logos://scan
export default function Scanner() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [reduce, sweep]);

  const scanLine = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * (FRAME - 24) }],
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
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
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.tr, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.bl, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.br, { borderColor: t.accent }]} />
          {!reduce ? (
            <Animated.View style={[styles.scanLine, { backgroundColor: t.accent }, scanLine]} />
          ) : null}
          <Ionicons name="barcode-outline" size={56} color="rgba(255,255,255,0.22)" />
        </View>
        <Text style={styles.hint}>Center the barcode on the back cover</Text>
        <View style={styles.devNote}>
          <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.6)" />
          <Text style={styles.devNoteText}>Live camera scanning unlocks in the dev build.</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Search the catalog instead" onPress={() => router.replace('/(modals)/add-book' as Href)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque near-black so the transparentModal route reads as a full-screen camera.
  root: { flex: 1, backgroundColor: '#08090C', paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 17, color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 34, height: 34 },
  tl: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  tr: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  bl: { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  br: { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  scanLine: { position: 'absolute', top: 12, left: 18, right: 18, height: 2, borderRadius: 2, opacity: 0.85 },
  hint: { fontFamily: FONTS.uiMedium, fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  devNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  devNoteText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  actions: {},
});
