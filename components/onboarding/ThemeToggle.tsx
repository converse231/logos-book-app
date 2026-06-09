import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { ThemePref } from '@/services/types';

interface ThemeToggleProps {
  value: ThemePref;
  onChange: (next: ThemePref) => void;
}

const OPTIONS: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dark', label: 'Dark', icon: 'moon' },
  { key: 'light', label: 'Light', icon: 'sunny' },
  { key: 'system', label: 'System', icon: 'phone-portrait' },
];

// Segmented theme selector. Each segment ≥44pt, selected state shown by fill +
// weight + accessibilityState.selected (not colour alone).
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.bgSec, borderColor: t.border }]}>
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${opt.label} theme`}
            style={[styles.segment, active && { backgroundColor: t.accent }]}
          >
            <Ionicons name={opt.icon} size={18} color={active ? t.onAccent : t.textSec} />
            <Text
              style={[
                styles.label,
                { color: active ? t.onAccent : t.textSec, fontFamily: active ? FONTS.uiBold : FONTS.uiMedium },
              ]}
            >
              {opt.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 0, borderWidth: 2, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { fontSize: 12, letterSpacing: 0.5 },
});
