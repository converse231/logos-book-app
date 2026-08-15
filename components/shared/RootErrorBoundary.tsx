import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { FONTS, PALETTE, INK, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { Q } from '@/components/shared/Q';

/**
 * The last thing between an uncaught render error and a blank screen.
 *
 * Expo Router shows its own error screen in development; in a release build
 * there is nothing, so a single bad render anywhere in the tree takes the app
 * down with no way back. Retry re-mounts the failed subtree, which is enough to
 * recover from the realistic causes — a malformed API payload, an image that
 * won't decode, a null that got through a type boundary.
 *
 * Deliberately theme-free. The theme provider lives INSIDE the tree this
 * catches, so reading from it here is exactly the kind of thing that would
 * throw a second time and defeat the point. Light Paper & Ink tokens are
 * hardcoded instead.
 */
export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.root}>
      <Q expression="shrug" size={150} decorative />
      <Text style={styles.title}>That didn’t go to plan</Text>
      <Text style={styles.body}>
        Something broke while drawing this screen. Your reading data is safe — it lives on the server, not
        here.
      </Text>

      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>TRY AGAIN</Text>
      </Pressable>

      {/* Shown so a tester can report something more useful than "it broke".
          Truncated because a full RN stack is thousands of characters. */}
      <Text style={styles.detail} numberOfLines={4}>
        {String(error?.message ?? error).slice(0, 300)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: '#F6EEDF',
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 32,
    color: INK,
    textAlign: 'center',
    ...NO_FONT_PAD,
  },
  body: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21, color: '#6E6250', textAlign: 'center', maxWidth: 320 },
  cta: {
    minHeight: 52,
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH_THICK,
    borderColor: INK,
    backgroundColor: PALETTE.accent,
    ...({ boxShadow: '4px 4px 0px #241E19' } as const),
  },
  ctaPressed: { transform: [{ translateX: 4 }, { translateY: 4 }], boxShadow: 'none' },
  ctaText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  detail: { fontFamily: FONTS.mono, fontSize: 10, lineHeight: 14, color: '#9A8E79', textAlign: 'center', marginTop: 14 },
});
