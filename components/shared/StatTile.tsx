import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, SHADOW } from '@/theme/tokens';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Reward hue for the icon + delta so a bento of tiles reads as a palette,
   *  not a wall of coral. Defaults to the coral accent. */
  color?: string;
}

// Single bento metric tile (blueprint #14). Tabular value figures so columns of
// tiles don't reflow as numbers change.
export function StatTile({ label, value, delta, icon, color }: StatTileProps) {
  const t = useTheme();
  const tint = color ?? t.accent;
  return (
    <View style={[styles.tile, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={18} color={tint} style={styles.icon} /> : null}
      <Text style={[styles.value, { color: t.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: t.textSec }]} numberOfLines={1}>
        {label}
      </Text>
      {delta ? <Text style={[styles.delta, { color: tint }]}>{delta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
    padding: 14,
    gap: 2,
    minHeight: 92,
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  icon: { marginBottom: 4 },
  value: { fontFamily: FONTS.monoBold, fontSize: 23, fontVariant: ['tabular-nums'] },
  label: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  delta: { fontFamily: FONTS.monoMedium, fontSize: 11, marginTop: 2 },
});
