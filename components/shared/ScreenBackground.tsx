import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

// Neubrutalism: a FLAT substrate fill (no gradients / glow / blur) overlaid with
// two tiled "analog degradation" textures — a faint blueprint crosshair grid and
// a fine paper grain. Both are tiny alpha PNGs tiled with resizeMode="repeat"
// and recoloured per-theme via tintColor, so they stay crisp at any size and
// flip ink↔light with the theme. Non-interactive, behind all content.
const grainSrc = require('../../assets/textures/grain.png');
const gridSrc = require('../../assets/textures/grid.png');

export function ScreenBackground({ children }: ScreenBackgroundProps) {
  const t = useTheme();
  const isDark = t.mode === 'dark';
  const tint = isDark ? '#FFFFFF' : '#141414';

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={gridSrc}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { tintColor: tint, opacity: isDark ? 0.06 : 0.05 }]}
        />
        <Image
          source={grainSrc}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { tintColor: tint, opacity: isDark ? 0.07 : 0.05 }]}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
