import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { TOUR_STEPS, markTourSeen, type TourTargetKey } from '@/lib/tour';
import { PressBlock } from '@/components/shared/PressBlock';
import { Q } from '@/components/shared/Q';

interface Frame { x: number; y: number; width: number; height: number; radius: number }

interface TourContextValue {
  hostRef: React.RefObject<View | null>;
  register: (key: TourTargetKey, frame: Frame) => void;
  /** Bumped whenever the active step changes, so the target about to be lit
   *  re-measures at its CURRENT position rather than wherever it was at mount. */
  measureNonce: number;
  offer: () => void;
  start: () => void;
  running: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>');
  return ctx;
}

/**
 * Attach to an element the tour spotlights.
 *
 * measureLayout, NOT measureInWindow. That distinction is the whole reason the
 * first version landed a status bar off on Android: measureInWindow answers in the
 * WINDOW's coordinate space, while the overlay is positioned inside the provider's
 * view — and under edge-to-edge (SDK 54's Android default) those two differ by the
 * status bar height. measureLayout answers relative to a node you name, so
 * measuring against the same view the overlay lives in puts both in one space by
 * construction. No inset to compensate for, on any device.
 *
 * All three targets are descendants of the provider (it wraps the tab shell), so a
 * single anchor serves elements in different navigation trees.
 */
export function useTourTarget(key: TourTargetKey | null, radius = 12) {
  const { register, measureNonce, hostRef } = useTour();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    // Null key = this instance isn't a target. Hooks can't be conditional, so
    // shared components (every tab icon renders the same one) pass null.
    if (!key || !ref.current || !hostRef.current) return;
    ref.current.measureLayout(
      hostRef.current,
      (x, y, width, height) => {
        if (width > 0 && height > 0) register(key, { x, y, width, height, radius });
      },
      () => {
        // Measuring can fail if the node is detached mid-transition. Staying
        // silent leaves the previous frame in place, which beats a spotlight
        // snapping to the corner.
      }
    );
  }, [key, radius, register, hostRef]);

  useEffect(() => {
    if (measureNonce > 0) {
      // One frame's grace so layout has settled after a step change.
      const id = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(id);
    }
  }, [measureNonce, measure]);

  return { ref, onLayout: measure };
}

// ─────────────────────────────────────────────────────────────────────────────

const PAD = 8;   // gap between the element and the cut-out edge
const GAP = 14;  // between the cut-out and the tooltip

export function TourProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  const hostRef = useRef<View>(null);
  // The host's OWN height, not the window's. Target frames are in host space, so
  // anchoring the tooltip against window height mixes spaces again — and on
  // Android under edge-to-edge the host extends beneath the navigation bar, so it
  // is TALLER than the reported window. That difference pushed the tooltip down
  // onto the spotlight it was meant to sit clear of.
  const [hostH, setHostH] = useState(0);
  const frames = useRef<Partial<Record<TourTargetKey, Frame>>>({});
  const [, force] = useState(0);
  const [measureNonce, setMeasureNonce] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'offer' | 'steps'>('idle');
  const [step, setStep] = useState(0);

  const register = useCallback((key: TourTargetKey, frame: Frame) => {
    const prev = frames.current[key];
    if (prev && Math.abs(prev.x - frame.x) < 1 && Math.abs(prev.y - frame.y) < 1) return;
    frames.current[key] = frame;
    force((n) => n + 1);
  }, []);

  const offer = useCallback(() => setPhase('offer'), []);
  const start = useCallback(() => {
    setStep(0);
    setMeasureNonce((n) => n + 1);
    setPhase('steps');
  }, []);
  const close = useCallback(() => {
    setPhase('idle');
    markTourSeen();
  }, []);

  const value = useMemo(
    () => ({ hostRef, register, measureNonce, offer, start, running: phase === 'steps' }),
    [register, measureNonce, offer, start, phase]
  );

  const current = TOUR_STEPS[step];
  const frame = current ? frames.current[current.key] : undefined;
  const last = step + 1 >= TOUR_STEPS.length;

  const advance = () => {
    Haptics.selectionAsync();
    if (last) return close();
    setStep((s) => s + 1);
    setMeasureNonce((n) => n + 1); // the next target re-measures before it's lit
  };

  // Fall back to the window only before the first layout pass.
  const H = hostH || winH;
  // Tooltip goes BELOW a target in the upper half, ABOVE one in the lower half —
  // the rule that keeps it off the thing it's describing.
  const below = frame ? frame.y + frame.height / 2 < H / 2 : true;

  return (
    <TourContext.Provider value={value}>
      {/* Every coordinate the overlay uses is relative to THIS view. */}
      <View
        style={styles.root}
        ref={hostRef}
        collapsable={false}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (Math.abs(h - hostH) > 1) setHostH(h);
        }}
      >
        {children}

        {phase !== 'idle' ? (
          <Animated.View
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            entering={reduce ? undefined : FadeIn.duration(200)}
            exiting={reduce ? undefined : FadeOut.duration(160)}
          >
            {phase === 'offer' || !frame ? (
              // No frame yet? Dim everything rather than showing a spotlight that
              // might be in the wrong place — a wrong highlight is worse than none.
              <Pressable style={styles.scrimFull} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss" />
            ) : (
              <>
                {/* Four rectangles around the target instead of a mask: no SVG, no
                    compositing cost, identical on both platforms. */}
                <Pressable style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, frame.y - PAD) }]} onPress={close} />
                <Pressable style={[styles.dim, { top: frame.y + frame.height + PAD, left: 0, right: 0, bottom: 0 }]} onPress={close} />
                <Pressable style={[styles.dim, { top: frame.y - PAD, left: 0, width: Math.max(0, frame.x - PAD), height: frame.height + PAD * 2 }]} onPress={close} />
                <Pressable style={[styles.dim, { top: frame.y - PAD, left: frame.x + frame.width + PAD, right: 0, height: frame.height + PAD * 2 }]} onPress={close} />
                <View
                  pointerEvents="none"
                  style={[
                    styles.ring,
                    {
                      top: frame.y - PAD,
                      left: frame.x - PAD,
                      width: frame.width + PAD * 2,
                      height: frame.height + PAD * 2,
                      // Concentric with the element: its own radius plus the gap.
                      borderRadius: frame.radius + PAD,
                      borderColor: t.accent,
                    },
                  ]}
                />
              </>
            )}

            {phase === 'offer' ? (
              <View style={[styles.sheet, { backgroundColor: t.bgSec, borderColor: t.border, paddingBottom: insets.bottom + 20 }]}>
                <Q expression="tour" size={128} animated={false} decorative />
                <Text style={[styles.title, { color: t.text }]}>Want the ten-second tour?</Text>
                <Text style={[styles.body, { color: t.textSec }]}>
                  Three taps and you&rsquo;ll know where everything is.
                </Text>
                <PressBlock
            emphasis="primary"
                  onPress={() => { Haptics.selectionAsync(); start(); }}
                  accessibilityLabel="Show me around"
                  radius={RADIUS.md}
                  containerStyle={styles.btnWrap}
                  style={[styles.primary, { backgroundColor: t.accent, borderColor: INK }]}
                >
                  <Text style={styles.primaryText}>SHOW ME AROUND</Text>
                </PressBlock>
                <PressBlock
                  onPress={close}
                  accessibilityLabel="Skip the tour"
                  radius={RADIUS.md}
                  containerStyle={styles.btnWrapSecond}
                  style={[styles.secondary, { backgroundColor: t.bgSec, borderColor: t.border }]}
                >
                  <Text style={[styles.secondaryText, { color: t.text }]}>I&rsquo;LL EXPLORE MYSELF</Text>
                </PressBlock>
                <Text style={[styles.later, { color: t.textTer }]}>You can take it later from More</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.tip,
                  { backgroundColor: t.bgSec, borderColor: t.border, maxWidth: Math.min(300, winW - 36) },
                  frame
                    ? below
                      ? { top: frame.y + frame.height + PAD + GAP }
                      : { bottom: H - (frame.y - PAD) + GAP }
                    : { top: H / 2 - 90 },
                ]}
              >
                <Text style={[styles.tipTitle, { color: t.text }]}>{current.title}</Text>
                <Text style={[styles.tipBody, { color: t.textSec }]}>{current.body}</Text>
                <View style={styles.tipRow}>
                  <View style={styles.dots}>
                    {TOUR_STEPS.map((s, i) => (
                      <View
                        key={s.key}
                        style={[styles.dot, i === step ? { backgroundColor: t.accent, width: 16 } : { backgroundColor: t.textTer }]}
                      />
                    ))}
                  </View>
                  <View style={styles.tipRight}>
                    {/* Skip lives here, not pinned to a corner where it would
                        eventually collide with a spotlight. */}
                    <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tour">
                      <Text style={[styles.skip, { color: t.textTer }]}>SKIP</Text>
                    </Pressable>
                    <PressBlock
                      onPress={advance}
                      accessibilityLabel={last ? 'Done' : 'Next step'}
                      radius={RADIUS.sm}
                      style={[styles.next, { backgroundColor: t.accent, borderColor: INK }]}
                    >
                      <Text style={styles.nextText}>{last ? 'DONE' : 'NEXT'}</Text>
                    </PressBlock>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

const SCRIM = 'rgba(10,8,6,0.74)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrimFull: { ...StyleSheet.absoluteFill, backgroundColor: SCRIM },
  dim: { position: 'absolute', backgroundColor: SCRIM },
  ring: { position: 'absolute', borderWidth: 2 },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center',
    borderTopWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.xl,
    paddingHorizontal: 22, paddingTop: 14,
  },
  title: { fontFamily: FONTS.serifBold, fontSize: 23, textAlign: 'center', marginTop: 4, ...NO_FONT_PAD },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  btnWrap: { alignSelf: 'stretch' },
  btnWrapSecond: { alignSelf: 'stretch', marginTop: 6 },
  primary: {
    minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
  },
  primaryText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
  secondary: {
    minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md,
  },
  secondaryText: { fontFamily: FONTS.uiBold, fontSize: 13.5, letterSpacing: 0.8 },
  later: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.6, marginTop: 12 },

  tip: {
    position: 'absolute', alignSelf: 'center',
    borderWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.md, padding: 14,
    boxShadow: `4px 4px 0px ${INK}`,
  },
  tipTitle: { fontFamily: FONTS.serifBold, fontSize: 17, lineHeight: 22, ...NO_FONT_PAD },
  tipBody: { fontFamily: FONTS.uiRegular, fontSize: 13, lineHeight: 19, marginTop: 5 },
  tipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  tipRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skip: { fontFamily: FONTS.monoBold, fontSize: 10.5, letterSpacing: 1.2 },
  next: {
    paddingHorizontal: 16, minHeight: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: BORDER_WIDTH, borderRadius: RADIUS.sm,
  },
  nextText: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1, color: PALETTE.onAccent, ...NO_FONT_PAD },
});
