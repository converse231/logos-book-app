import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, RADIUS, SHADOW } from '@/theme/tokens';
import { ProgressBar } from '@/components/shared/ProgressBar';

export interface ChallengeCardProps {
  tone: 'emerald' | 'gold';
  icon: keyof typeof Ionicons.glyphMap;
  kicker: string;
  title: string;
  footer: string;
  progress?: number; // 0–1, omit for status-only cards
  onPress: () => void;
}

const TONES = {
  emerald: { color: PALETTE.accent, soft: PALETTE.accentAlpha16 },
  gold: { color: PALETTE.gold, soft: 'rgba(255,197,61,0.16)' },
} as const;

// A single challenge in the home carousel. A tinted glow + icon chip give each
// card its own energy; an optional progress bar shows momentum.
export function ChallengeCard({ tone, icon, kicker, title, footer, progress, onPress }: ChallengeCardProps) {
  const t = useTheme();
  const { color, soft } = TONES[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}: ${title}`}
      style={({ pressed }) => [styles.card, { backgroundColor: t.bgSec }, pressed && styles.pressed]}
    >
      <View style={[styles.glow, { backgroundColor: soft }]} pointerEvents="none" />
      <View style={styles.top}>
        <View style={[styles.iconChip, { backgroundColor: soft }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.kicker, { color }]}>{kicker.toUpperCase()}</Text>
      </View>

      <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.bottom}>
        {progress !== undefined ? <ProgressBar value={progress} max={1} height={6} accent={color} animateOnMount={false} /> : null}
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
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.cardBorder,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  pressed: { opacity: 0.85 },
  glow: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 130 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  title: { fontFamily: FONTS.uiSemiBold, fontSize: 17, lineHeight: 22, marginTop: 12 },
  bottom: { gap: 8, marginTop: 14 },
  footer: { fontFamily: FONTS.uiMedium, fontSize: 12 },
});
