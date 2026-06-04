import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { LevelName } from '@/services/types';

interface LevelNameBadgeProps {
  levelName: LevelName | string;
  context?: 'share_card' | 'home' | 'alert';
  mode?: 'transparent' | 'dark';
  size?: 'sm' | 'md';
}

// Identity pill (blueprint 4E). The level name is the user's identity surface;
// it appears on cards, alerts, and home. Read-only — the value comes from the
// server (trigger-maintained). Colour rules per context/mode from the spec.
export function LevelNameBadge({
  levelName,
  context = 'home',
  mode = 'dark',
  size = 'md',
}: LevelNameBadgeProps) {
  const t = useTheme();

  let bg: string;
  let fg: string;
  if (context === 'share_card') {
    bg = mode === 'transparent' ? 'rgba(255,255,255,0.20)' : t.gold;
    fg = '#FFFFFF';
  } else {
    bg = 'rgba(61,123,255,0.14)';
    fg = t.accent;
  }

  return (
    <View
      style={[styles.pill, { backgroundColor: bg }, size === 'sm' && styles.pillSm]}
      accessibilityRole="text"
      accessibilityLabel={`Level: ${levelName}`}
    >
      <Text
        style={[styles.text, { color: fg }, size === 'sm' && styles.textSm]}
        numberOfLines={1}
      >
        {levelName.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillSm: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1 },
  textSm: { fontSize: 10, letterSpacing: 0.8 },
});
