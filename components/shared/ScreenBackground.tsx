import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

const CELL = 46;  // dot spacing in dp
const DOT = 2.5;  // dot diameter in dp

// Paper & Ink substrate: a warm FLAT fill (no gradients / glow / blur) overlaid
// with a faint dot-journal grid — the warm cozy cousin of neubrutalism's harsh
// blueprint lines, evoking a reader's dotted notebook. Drawn as small absolutely-
// positioned dot Views (RN's `<Image resizeMode="repeat">` does NOT tile reliably
// on the New Architecture). Memoised on size/mode so it renders once and never
// re-renders on data refetches; non-interactive, behind all content.
export function ScreenBackground({ children }: ScreenBackgroundProps) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const isDark = t.mode === 'dark';
  const dotColor = isDark ? 'rgba(246,238,223,0.055)' : 'rgba(36,30,25,0.06)';

  const dots = useMemo(() => {
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const out: { key: string; left: number; top: number }[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        out.push({ key: `${r}-${c}`, left: c * CELL, top: r * CELL });
      }
    }
    return out;
  }, [width, height]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {dots.map((d) => (
          <View
            key={d.key}
            style={[styles.dot, { left: d.left, top: d.top, backgroundColor: dotColor }]}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
});
