import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';
import { CENTER_COLUMN_FILL, CONTENT_MAX_WIDTH } from '@/theme/layout';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

const CELL = 46;  // dot spacing in dp
const DOT = 2.5;  // dot diameter in dp

// Paper & Ink substrate: a warm FLAT fill (no gradients / glow / blur) overlaid
// with a faint dot-journal grid — the warm cozy cousin of neubrutalism's harsh
// blueprint lines, evoking a reader's dotted notebook.
//
// The grid is ONE <Svg> painting a tiled <Pattern>. It used to be one absolutely-
// positioned <View> per dot, which on a phone meant ~200 native views on every
// screen and 744 on an iPad Pro — all of them mounted, measured and composited
// before any content. A pattern fill is a single node the GPU repeats.
// (RN's `<Image resizeMode="repeat">` does NOT tile reliably on the New
// Architecture, which is why the View grid existed in the first place.)
//
// TABLET: the paper + dots bleed to the device edges, but content is clamped to
// the centred reading column (see theme/layout.ts) so every screen keeps its
// phone proportions. Two faint ink rules mark the column edges — the same
// margin-rule language as a ruled notebook, so the gutters read as deliberate
// rather than as an unstretched phone app.
export function ScreenBackground({ children }: ScreenBackgroundProps) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const isDark = t.mode === 'dark';
  const dotColor = isDark ? '#F6EEDF' : '#241E19';
  const dotOpacity = isDark ? 0.055 : 0.06;
  const ruleOpacity = isDark ? 0.1 : 0.07;
  const gutter = Math.max(0, (width - CONTENT_MAX_WIDTH) / 2);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height}>
          <Defs>
            <Pattern id="dotgrid" x="0" y="0" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
              <Circle cx={DOT / 2} cy={DOT / 2} r={DOT / 2} fill={dotColor} fillOpacity={dotOpacity} />
            </Pattern>
          </Defs>
          <Rect width={width} height={height} fill="url(#dotgrid)" />
          {gutter > 0 ? (
            <>
              <Rect x={gutter} y={0} width={StyleSheet.hairlineWidth} height={height} fill={t.text} fillOpacity={ruleOpacity} />
              <Rect x={width - gutter} y={0} width={StyleSheet.hairlineWidth} height={height} fill={t.text} fillOpacity={ruleOpacity} />
            </>
          ) : null}
        </Svg>
      </View>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: CENTER_COLUMN_FILL,
});
