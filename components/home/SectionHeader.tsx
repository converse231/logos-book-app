import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Editorial section header — a literary serif title with an optional quiet
// action link. Used to introduce the home carousels.
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel} style={styles.action}>
          <Text style={[styles.actionText, { color: t.accent }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={t.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: FONTS.serifBold, fontSize: 26, lineHeight: 28, letterSpacing: 0 },
  action: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  actionText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
});
