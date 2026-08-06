import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** "Continue with Google" reads right in a signup funnel; "Sign in with
   *  Google" on the returning-user screen. */
  label?: string;
}

// Secondary to the primary action on both screens it appears on: cream fill, ink
// border, same hard shadow as every other block. Coral is reserved for the
// screen's own primary button so the two never compete.
export function GoogleButton({ onPress, loading, disabled, label = 'Continue with Google' }: GoogleButtonProps) {
  const t = useTheme();
  return (
    <PressBlock
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        styles.btn,
        { backgroundColor: t.bgSec, borderColor: t.border },
        (disabled || loading) && styles.dim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.text} />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={19} color={t.text} />
          <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        </View>
      )}
    </PressBlock>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER_WIDTH_THICK,
    borderRadius: RADIUS.md,
  },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.3, ...NO_FONT_PAD },
});
