import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
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
      style={[styles.banner, { backgroundColor: t.accentMuted, borderColor: 'rgba(61,123,255,0.32)' }]}
    >
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: 'rgba(61,123,255,0.18)' }]}>
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
  banner: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14, lineHeight: 18 },
});
