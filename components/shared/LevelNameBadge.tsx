import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, PALETTE, NO_FONT_PAD } from '@/theme/tokens';
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
    bg = mode === 'transparent' ? 'rgba(255,255,255,0.22)' : '#F3C24C';
    fg = mode === 'transparent' ? '#FFFFFF' : '#241E19';
  } else {
    // The level name IS the XP/level identity, and gold owns levels — so the
    // badge is a solid marigold pill with ink text (not coral). High contrast,
    // and it brings gold into the home/stats surfaces where coral used to rule.
    bg = PALETTE.gold;
    fg = '#241E19';
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
  pill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  pillSm: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1, ...NO_FONT_PAD },
  textSm: { fontSize: 10, letterSpacing: 0.8 },
});
