import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

const CELL = 40; // grid cell size in dp

// Neubrutalism substrate: a FLAT fill (no gradients / glow / blur) overlaid with a
// blueprint grid. The grid is drawn as thin absolutely-positioned line Views — RN's
// `<Image resizeMode="repeat">` does NOT tile reliably on the New Architecture (it
// renders a single tile in the corner), so we draw the lines directly. Crisp at any
// size, ink on light / white on dark, non-interactive, behind all content.
export function ScreenBackground({ children }: ScreenBackgroundProps) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const isDark = t.mode === 'dark';
  const line = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(20,20,20,0.08)';

  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.vLine, { left: i * CELL, backgroundColor: line }]} />
        ))}
        {Array.from({ length: rows + 1 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.hLine, { top: i * CELL, backgroundColor: line }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1 },
});
