import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

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
      <PressBlock
        onPress={onRetry}
        haptic="light"
        accessibilityLabel="Try again"
        containerStyle={styles.btnWrap}
        style={[styles.btn, { backgroundColor: t.accent, borderColor: t.border }]}
      >
        <Ionicons name="refresh" size={18} color={t.onAccent} />
        <Text style={[styles.btnText, { color: t.onAccent }]}>TRY AGAIN</Text>
      </PressBlock>
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
  btnWrap: { marginTop: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1 },
});
