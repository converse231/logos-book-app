import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
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
  let bordered = false;
  if (context === 'share_card') {
    // On the share canvas: gold block (black ink text) in dark mode, translucent
    // chip on transparent backgrounds. No border so it sits cleanly over photos.
    bg = mode === 'transparent' ? 'rgba(255,255,255,0.22)' : '#FFC53D';
    fg = mode === 'transparent' ? '#FFFFFF' : '#141414';
  } else {
    bg = t.accentMuted;
    fg = t.accent;
    bordered = true;
  }

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg },
        bordered && { borderWidth: BORDER_WIDTH, borderColor: t.border },
        size === 'sm' && styles.pillSm,
      ]}
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
  pill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 0 },
  pillSm: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1 },
  textSm: { fontSize: 10, letterSpacing: 0.8 },
});
