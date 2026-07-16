import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, SHADOW } from '@/theme/tokens';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface AlmostThereBannerProps {
  label: string;
  progress: number; // 0–1
  icon?: keyof typeof Ionicons.glyphMap;
  /** Reward hue — defaults to lilac (the milestone/almost-there colour). Pass
   *  gold for achievement progress, ember for streak progress, etc. */
  color?: string;
  onPress?: () => void;
}

// "You're almost there" nudge (blueprint component). A near-complete progress bar
// — loss-aversion pull toward the next unlock. Tone-coloured so it isn't coral.
export function AlmostThereBanner({ label, progress, icon = 'ribbon', color, onPress }: AlmostThereBannerProps) {
  const t = useTheme();
  const c = color ?? t.level;
  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? label : undefined}
      style={[styles.banner, { backgroundColor: t.bgSec, borderColor: t.border }]}
    >
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: t.bgTer, borderColor: t.border }]}>
          <Ionicons name={icon} size={16} color={c} />
        </View>
        <Text style={[styles.label, { color: t.text }]} numberOfLines={2}>
          {label}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={c} /> : null}
      </View>
      <ProgressBar value={progress} max={1} height={6} accent={c} />
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 14, borderWidth: BORDER_WIDTH, padding: 14, gap: 12, ...SHADOW.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 30, height: 30, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: FONTS.uiBold, fontSize: 14, lineHeight: 18 },
});
