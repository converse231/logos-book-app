import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { ProgressBar } from '@/components/shared/ProgressBar';

export interface ChallengeCardProps {
  tone: 'coral' | 'gold' | 'ember' | 'lilac';
  icon: keyof typeof Ionicons.glyphMap;
  kicker: string;
  title: string;
  footer: string;
  progress?: number; // 0–1, omit for status-only cards
  onPress: () => void;
}

// A single challenge in the home carousel — a soft-brutalist block: flat fill,
// thick ink border, hard offset shadow, rounded icon chip. Each tone owns a
// reward colour so the carousel reads as a palette: coral action · gold XP/goal ·
// ember streak · lilac milestone.
export function ChallengeCard({ tone, icon, kicker, title, footer, progress, onPress }: ChallengeCardProps) {
  const t = useTheme();
  const TONE = {
    coral: { color: t.accent, soft: t.accentMuted },
    gold: { color: t.gold, soft: 'rgba(243,194,60,0.16)' },
    ember: { color: t.ember, soft: 'rgba(242,145,63,0.16)' },
    lilac: { color: t.level, soft: 'rgba(154,123,214,0.18)' },
  } as const;
  const { color, soft } = TONE[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}: ${title}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.bgSec, borderColor: t.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.iconChip, { backgroundColor: soft, borderColor: t.border }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.kicker, { color }]}>{kicker.toUpperCase()}</Text>
      </View>

      <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.bottom}>
        {progress !== undefined ? <ProgressBar value={progress} max={1} height={8} accent={color} animateOnMount={false} /> : null}
        <Text style={[styles.footer, { color: t.textSec }]} numberOfLines={1}>
          {footer}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 246,
    minHeight: 158,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH_THICK,
    padding: 16,
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 36, height: 36, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: FONTS.uiBold, fontSize: 17, lineHeight: 22, marginTop: 12 },
  bottom: { gap: 8, marginTop: 14 },
  footer: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.3 },
});
