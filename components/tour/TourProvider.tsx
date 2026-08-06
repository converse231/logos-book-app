import {
  createContext,
  useCallback,
  useContext,
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
  /** A spotlightable element reporting where it is, in window coordinates. */
  register: (key: TourTargetKey, frame: Frame) => void;
  /** Bumped when the tour starts so every target re-measures — a frame captured
   *  at mount can be stale by the time anyone looks at it. */
  measureNonce: number;
  /** Show the opt-in sheet. */
  offer: () => void;
  /** Skip the sheet and go straight into the steps (the More entry point). */
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
 * Attach to any element the tour spotlights.
 *
 * Uses measureInWindow rather than onLayout's own coordinates because those are
 * relative to the parent — and the three targets live in different trees (the FAB
 * and the tab icon in the tabs layout, the streak on Home). Window coordinates are
 * the only frame all three can express in common.
 */
export function useTourTarget(key: TourTargetKey | null, radius = 12) {
  const { register, measureNonce } = useTour();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    // Null key = this instance isn't a target. Hooks can't be conditional, so
    // shared components (every tab icon uses the same one) pass null and register
    // nothing — otherwise all four tabs would claim the same key and the last one
    // laid out would win.
    if (!key) return;
    // A frame of zeroes means "not laid out yet"; registering it would put the
    // spotlight in the top-left corner.
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) register(key, { x, y, width, height, radius });
    });
  }, [key, register, radius]);

  // onLayout covers first paint; measureNonce covers "the tour just started and
  // the screen may have moved since".
  useMemo(() => {
    if (measureNonce > 0) requestAnimationFrame(measure);
  }, [measureNonce, measure]);

  return { ref, onLayout: measure };
}

// ─────────────────────────────────────────────────────────────────────────────

const PAD = 8;        // breathing room between the element and the cut-out edge
const GAP = 14;       // between the cut-out and the tooltip

export function TourProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  const frames = useRef<Partial<Record<TourTargetKey, Frame>>>({});
  const [, force] = useState(0);
  const [measureNonce, setMeasureNonce] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'sheet' | 'steps'>('idle');
  const [step, setStep] = useState(0);

  const register = useCallback((key: TourTargetKey, frame: Frame) => {
    const prev = frames.current[key];
    if (prev && Math.abs(prev.x - frame.x) < 1 && Math.abs(prev.y - frame.y) < 1) return;
    frames.current[key] = frame;
    force((n) => n + 1);
  }, []);

  const offer = useCallback(() => setPhase('sheet'), []);

  const start = useCallback(() => {
    setStep(0);
    setMeasureNonce((n) => n + 1); // re-measure before anything is drawn over
    setPhase('steps');
  }, []);

  const finish = useCallback(() => {
    setPhase('idle');
    markTourSeen();
  }, []);

  const decline = useCallback(() => {
    setPhase('idle');
    markTourSeen();
  }, []);

  const value = useMemo(
    () => ({ register, measureNonce, offer, start, running: phase === 'steps' }),
    [register, measureNonce, offer, start, phase]
  );

  const current = TOUR_STEPS[step];
  const frame = current ? frames.current[current.key] : undefined;

  const advance = () => {
    Haptics.selectionAsync();
    if (step + 1 >= TOUR_STEPS.length) return finish();
    setStep((s) => s + 1);
  };

  // Tooltip goes ABOVE a target in the lower half, BELOW one in the upper half.
  // That single rule is what keeps it off the thing it's describing.
  const below = frame ? frame.y + frame.height / 2 < winH / 2 : true;

  return (
    <TourContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {phase === 'sheet' ? (
          <Animated.View
            style={StyleSheet.absoluteFill}
            entering={reduce ? undefined : FadeIn.duration(220)}
            exiting={reduce ? undefined : FadeOut.duration(160)}
          >
            <Pressable style={styles.scrim} onPress={decline} accessibilityRole="button" accessibilityLabel="Dismiss" />
            <View style={[styles.sheet, { backgroundColor: t.bgSec, borderColor: t.border, paddingBottom: insets.bottom + 20 }]}>
              <Q expression="tour" size={128} animated={false} decorative />
              <Text style={[styles.sheetTitle, { color: t.text }]}>Want the ten-second tour?</Text>
              <Text style={[styles.sheetBody, { color: t.textSec }]}>
                Three taps and you&rsquo;ll know where everything is.
              </Text>
              <PressBlock
                onPress={() => {
                  Haptics.selectionAsync();
                  start();
                }}
                accessibilityLabel="Show me around"
                radius={RADIUS.md}
                containerStyle={styles.btnWrap}
                style={[styles.primary, { backgroundColor: t.accent, borderColor: INK }]}
              >
                <Text style={styles.primaryText}>SHOW ME AROUND</Text>
              </PressBlock>
              <PressBlock
                onPress={decline}
                accessibilityLabel="Skip the tour"
                radius={RADIUS.md}
                containerStyle={styles.btnWrapSecond}
                style={[styles.secondary, { backgroundColor: t.bgSec, borderColor: t.border }]}
              >
                <Text style={[styles.secondaryText, { color: t.text }]}>I&rsquo;LL EXPLORE MYSELF</Text>
              </PressBlock>
              {/* The line that makes "no" cheap. */}
              <Text style={[styles.later, { color: t.textTer }]}>You can take it later from More</Text>
            </View>
          </Animated.View>
        ) : null}

        {phase === 'steps' && current ? (
          <Animated.View
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            entering={reduce ? undefined : FadeIn.duration(200)}
            exiting={reduce ? undefined : FadeOut.duration(160)}
          >
            {frame ? (
              <>
                {/* The dim is four rectangles around the target, not a mask — no SVG,
                    no compositing cost, and it works identically on both platforms. */}
                <Pressable style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, frame.y - PAD) }]} onPress={finish} />
                <Pressable style={[styles.dim, { top: frame.y + frame.height + PAD, left: 0, right: 0, bottom: 0 }]} onPress={finish} />
                <Pressable style={[styles.dim, { top: frame.y - PAD, left: 0, width: Math.max(0, frame.x - PAD), height: frame.height + PAD * 2 }]} onPress={finish} />
                <Pressable style={[styles.dim, { top: frame.y - PAD, left: frame.x + frame.width + PAD, right: 0, height: frame.height + PAD * 2 }]} onPress={finish} />
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
                      // A fixed radius made a squircle FAB look boxed-in.
                      borderRadius: frame.radius + PAD,
                      borderColor: t.accent,
                    },
                  ]}
                />
              </>
            ) : (
              // No frame yet (a target that hasn't laid out). Dim everything rather
              // than flashing a spotlight in the corner.
              <Pressable style={[styles.dim, StyleSheet.absoluteFillObject]} onPress={finish} />
            )}

            <View
              style={[
                styles.tip,
                { backgroundColor: t.bgSec, borderColor: t.border, maxWidth: Math.min(280, winW - 40) },
                frame
                  ? below
                    ? { top: frame.y + frame.height + PAD + GAP }
                    : { bottom: winH - (frame.y - PAD) + GAP }
                  : { top: winH / 2 - 80 },
              ]}
            >
              <Text style={[styles.tipTitle, { color: t.text }]}>{current.title}</Text>
              <Text style={[styles.tipBody, { color: t.textSec }]}>{current.body}</Text>
              <View style={styles.tipRow}>
                <View style={styles.dots}>
                  {TOUR_STEPS.map((s, i) => (
                    <View
                      key={s.key}
                      style={[
                        styles.dot,
                        i === step
                          ? { backgroundColor: t.accent, width: 14 }
                          : { backgroundColor: t.textTer },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.tipRight}>
                  {/* Skip lives here rather than pinned to a corner, where it would
                      eventually collide with a spotlight. */}
                  <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip the tour">
                    <Text style={[styles.skip, { color: t.textTer }]}>SKIP</Text>
                  </Pressable>
                  <PressBlock
                    onPress={advance}
                    accessibilityLabel={step + 1 >= TOUR_STEPS.length ? 'Done' : 'Next step'}
                    radius={RADIUS.sm}
                    style={[styles.next, { backgroundColor: t.accent, borderColor: INK }]}
                  >
                    <Text style={styles.nextText}>{step + 1 >= TOUR_STEPS.length ? 'DONE' : 'NEXT'}</Text>
                  </PressBlock>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

const SCRIM = 'rgba(10,8,6,0.74)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: SCRIM },
  dim: { position: 'absolute', backgroundColor: SCRIM },
  ring: { position: 'absolute', borderWidth: 2 },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center',
    borderTopWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.xl,
    paddingHorizontal: 22, paddingTop: 14,
  },
  sheetTitle: { fontFamily: FONTS.serifBold, fontSize: 23, textAlign: 'center', marginTop: 4, ...NO_FONT_PAD },
  sheetBody: { fontFamily: FONTS.uiRegular, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  // PressBlock renders its hard shadow OUTSIDE the face and reserves the overhang
  // as padding on its container — so alignSelf and margins belong there, not on
  // the face. Putting them on `style` is what made these look clipped and cramped.
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
