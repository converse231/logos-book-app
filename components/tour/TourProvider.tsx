import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, INK, BORDER_WIDTH_THICK, RADIUS, NO_FONT_PAD } from '@/theme/tokens';
import { CENTER_COLUMN } from '@/theme/layout';
import { TOUR_STEPS, markTourSeen } from '@/lib/tour';
import { PressBlock } from '@/components/shared/PressBlock';
import { Q } from '@/components/shared/Q';

interface TourContextValue {
  /** Show the opt-in sheet. */
  offer: () => void;
  /** Skip the sheet and go straight into the cards (the More entry point). */
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
 * The guided tour: one sheet, four states — the offer, then three cards.
 *
 * Nothing is measured. An earlier version cut a spotlight into the live UI, which
 * misaligned on Android because measureInWindow and absolute positioning disagree
 * about the status bar under edge-to-edge. A fixed layout can't be off by an inset.
 *
 * Home stays dimmed behind the sheet throughout, so this still reads as "a note
 * about the app you're looking at" rather than a separate screen.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<'idle' | 'offer' | 'steps'>('idle');
  const [step, setStep] = useState(0);

  const offer = useCallback(() => setPhase('offer'), []);
  const start = useCallback(() => {
    setStep(0);
    setPhase('steps');
  }, []);
  const close = useCallback(() => {
    setPhase('idle');
    markTourSeen();
  }, []);

  const value = useMemo(() => ({ offer, start, running: phase === 'steps' }), [offer, start, phase]);

  const advance = () => {
    Haptics.selectionAsync();
    if (step + 1 >= TOUR_STEPS.length) return close();
    setStep((s) => s + 1);
  };

  const current = TOUR_STEPS[step];
  const last = step + 1 >= TOUR_STEPS.length;

  return (
    <TourContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {phase !== 'idle' ? (
          <Animated.View
            style={StyleSheet.absoluteFill}
            entering={reduce ? undefined : FadeIn.duration(200)}
            exiting={reduce ? undefined : FadeOut.duration(160)}
          >
            {/* Home stays visible behind, so declining never feels like leaving. */}
            <Pressable
              style={styles.scrim}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            />

            <View
              style={[
                styles.sheet,
                { backgroundColor: t.bgSec, borderColor: t.border, paddingBottom: insets.bottom + 20 },
              ]}
            >
              {phase === 'offer' ? (
                <>
                  <Q expression="tour" size={128} animated={false} decorative />
                  <Text style={[styles.title, { color: t.text }]}>Want the ten-second tour?</Text>
                  <Text style={[styles.body, { color: t.textSec }]}>
                    Three cards and you&rsquo;ll know where everything is.
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
                    onPress={close}
                    accessibilityLabel="Skip the tour"
                    radius={RADIUS.md}
                    containerStyle={styles.btnWrapSecond}
                    style={[styles.secondary, { backgroundColor: t.bgSec, borderColor: t.border }]}
                  >
                    <Text style={[styles.secondaryText, { color: t.text }]}>I&rsquo;LL EXPLORE MYSELF</Text>
                  </PressBlock>
                  {/* The line that makes "no" cheap. */}
                  <Text style={[styles.later, { color: t.textTer }]}>You can take it later from More</Text>
                </>
              ) : (
                <>
                  {/* Keyed so React swaps the artwork rather than cross-fading one
                      image into another mid-transition. */}
                  <Q key={current.key} expression={current.expression} size={128} animated={false} decorative />
                  <Text style={[styles.title, { color: t.text }]}>{current.title}</Text>
                  <Text style={[styles.body, { color: t.textSec }]}>{current.body}</Text>

                  <View style={styles.dots}>
                    {TOUR_STEPS.map((s, i) => (
                      <View
                        key={s.key}
                        style={[
                          styles.dot,
                          i === step ? { backgroundColor: t.accent, width: 18 } : { backgroundColor: t.textTer },
                        ]}
                      />
                    ))}
                  </View>

                  <PressBlock
                    onPress={advance}
                    accessibilityLabel={last ? 'Done' : 'Next'}
                    radius={RADIUS.md}
                    containerStyle={styles.btnWrap}
                    style={[styles.primary, { backgroundColor: t.accent, borderColor: INK }]}
                  >
                    <Text style={styles.primaryText}>{last ? 'START READING' : 'NEXT'}</Text>
                  </PressBlock>
                  <Pressable
                    onPress={close}
                    accessibilityRole="button"
                    accessibilityLabel="Skip the tour"
                    style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.skipText, { color: t.textTer }]}>SKIP</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,8,6,0.74)' },

  sheet: {
    ...CENTER_COLUMN,
    position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center',
    borderTopWidth: BORDER_WIDTH_THICK, borderRadius: RADIUS.xl,
    paddingHorizontal: 22, paddingTop: 14,
    // A floor, so the sheet doesn't visibly resize as the three cards' copy
    // changes length — it should feel like one surface with the content swapping.
    minHeight: 400,
  },
  title: { fontFamily: FONTS.serifBold, fontSize: 23, textAlign: 'center', marginTop: 4, ...NO_FONT_PAD },
  body: {
    fontFamily: FONTS.uiRegular, fontSize: 14.5, lineHeight: 21, textAlign: 'center',
    marginTop: 8, marginBottom: 18, maxWidth: 320,
  },

  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 99 },

  // PressBlock renders its hard shadow OUTSIDE the face and reserves the overhang
  // as padding on its container, so alignSelf and margins belong there.
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
  skip: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  skipText: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1.4 },
});
