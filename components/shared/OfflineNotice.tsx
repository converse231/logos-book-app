import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

interface OfflineNoticeProps {
  /** Omit to render the notice without a retry affordance (ambient surfaces). */
  onRetry?: () => void;
  message?: string;
  /** Inline strip vs. a centred block that owns the empty area. */
  variant?: 'banner' | 'block';
}

// "We couldn't reach the catalog" — never "no results". The catalog lives on two
// third-party APIs, so a dead connection and a genuinely unknown title used to
// produce the same empty list and the same wrong sentence.
export function OfflineNotice({
  onRetry,
  message = "We couldn't reach the book catalog. Check your connection and try again.",
  variant = 'banner',
}: OfflineNoticeProps) {
  const t = useTheme();
  const block = variant === 'block';

  return (
    <View
      accessibilityRole="alert"
      style={[
        block ? styles.block : styles.banner,
        { backgroundColor: t.bgTer, borderColor: t.border },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={block ? 26 : 18} color={t.textSec} />
      <Text style={[block ? styles.blockText : styles.text, { color: t.textSec }]}>{message}</Text>
      {onRetry ? (
        <PressBlock
          onPress={onRetry}
          haptic="light"
          offset={2}
          radius={RADIUS.sm}
          accessibilityLabel="Try the search again"
          containerStyle={block ? styles.blockBtn : undefined}
          style={[styles.btn, { backgroundColor: t.bgSec, borderColor: t.border }]}
        >
          <Text style={[styles.btnText, { color: t.text }]}>RETRY</Text>
        </PressBlock>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH,
  },
  block: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH,
  },
  text: { flex: 1, fontFamily: FONTS.uiRegular, fontSize: 13, lineHeight: 18 },
  blockText: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  blockBtn: { marginTop: 4 },
  btn: {
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
});
