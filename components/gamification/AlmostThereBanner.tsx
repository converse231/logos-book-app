import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, SHADOW } from '@/theme/tokens';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface AlmostThereBannerProps {
  label: string;
  progress: number; // 0–1
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

// "You're almost there" nudge (blueprint component). A tinted banner with a
// near-complete progress bar — loss-aversion pull toward the next unlock.
export function AlmostThereBanner({ label, progress, icon = 'ribbon', onPress }: AlmostThereBannerProps) {
  const t = useTheme();
  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? label : undefined}
      style={[styles.banner, { backgroundColor: t.accentMuted, borderColor: t.border }]}
    >
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: t.bgSec, borderColor: t.border }]}>
          <Ionicons name={icon} size={16} color={t.accent} />
        </View>
        <Text style={[styles.label, { color: t.text }]} numberOfLines={2}>
          {label}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={t.accent} /> : null}
      </View>
      <ProgressBar value={progress} max={1} height={6} />
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 0, borderWidth: BORDER_WIDTH, padding: 14, gap: 12, ...SHADOW.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 30, height: 30, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: FONTS.uiBold, fontSize: 14, lineHeight: 18 },
});
