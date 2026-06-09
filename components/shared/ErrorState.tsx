import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';

interface ErrorStateProps {
  onRetry: () => void;
  title?: string;
  message?: string;
}

// Graceful failure state (blueprint Section 12 / skill error-recovery). Always
// offers a clear recovery path. Rendered inside a screen's ScreenBackground.
export function ErrorState({
  onRetry,
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
}: ErrorStateProps) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: t.bgSec, borderColor: t.border }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={t.textSec} />
      </View>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.message, { color: t.textSec }]}>{message}</Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRetry();
        }}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: t.accent, borderColor: t.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="refresh" size={18} color={t.onAccent} />
        <Text style={[styles.btnText, { color: t.onAccent }]}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 12 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  title: { fontFamily: FONTS.uiBold, fontSize: 19, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  message: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK,
    marginTop: 8,
    ...SHADOW.sm,
  },
  pressed: { opacity: 0.85, transform: [{ translateX: 2 }, { translateY: 2 }] },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1 },
});
