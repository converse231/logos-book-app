import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK, RADIUS } from '@/theme/tokens';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { PressBlock } from '@/components/shared/PressBlock';
import { Q } from '@/components/shared/Q';

// Deep-link fallback. It used to render unstyled system text with a plain-text
// link — the one screen in the app that looked like a different app — with no
// safe-area inset and a hit target the size of the word. It is rare, but it is
// the first thing a reader sees when a stale notification link misses.
export default function NotFound() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Q expression="shrug" size={132} decorative />
        <Text style={[styles.title, { color: t.text }]}>This page has wandered off</Text>
        <Text style={[styles.body, { color: t.textSec }]}>
          That link doesn&apos;t lead anywhere in Quire any more. Your reading is safe — pick up where
          you left off.
        </Text>
        <PressBlock
          onPress={() => router.replace('/(tabs)/home' as Href)}
          haptic="light"
          emphasis="primary"
          accessibilityLabel="Go to Home"
          containerStyle={styles.btnWrap}
          style={[styles.btn, { backgroundColor: t.accent, borderColor: t.border }]}
        >
          <Ionicons name="home" size={18} color={t.onAccent} />
          <Text style={[styles.btnText, { color: t.onAccent }]}>GO HOME</Text>
        </PressBlock>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 31,
    textAlign: 'center',
    marginTop: 8,
  },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  btnWrap: { marginTop: 18 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 28,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH_THICK,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1 },
});
