import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

// Shallower than PressBlock's default 4 — these sit INSIDE a bar that already
// carries a 4px hard shadow, and matching it would read as two stacked cards.
const SHADOW_OFFSET = 3;

interface SessionControlBarProps {
  isPaused: boolean;
  canStop: boolean;
  stopUnlocksInSec?: number;
  /** Pause is hidden in focus mode (a committed, un-pausable session). */
  showPause?: boolean;
  /** Long-press escape while a focus block is still locked — ends early and
   *  finishes (records) the session. Only wired during the focus countdown. */
  onEndEarly?: () => void;
  onTogglePause: () => void;
  onStop: () => void;
}

// Locked-finish countdown: seconds for a short wait, m:ss once it's a minute+.
function formatLock(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * A FLAT control in the bar — pause, finish, and the locked focus button.
 *
 * RESUME is a real PressBlock (it's the primary action and earns the shadow);
 * these stay flat so the bar doesn't become a stack of hard shadows inside a bar
 * that already has one. They express the same hierarchy through scale instead, and
 * `reserve` keeps their footprint identical to PressBlock's so nothing shifts when
 * they sit side by side or when the bar swaps between states.
 *
 * primary   squeezes further and springs back past rest on release
 * secondary squeezes less, warms its fill, and returns without overshoot
 */
function BarButton({
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  emphasis = 'secondary',
  reserve = 0,
  fill,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  emphasis?: 'primary' | 'secondary';
  /** Reserve the same footprint a PressBlock's hard shadow occupies, so a flat
   *  button sitting beside one lines up — and so the bar doesn't change height
   *  between the running and paused states. */
  reserve?: number;
  /** Resting fill; the pressed tint is derived from it. */
  fill: string;
  style?: any;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { disabled?: boolean };
}) {
  const reduce = useReducedMotion();
  const t = useTheme();
  const p = useSharedValue(0);
  const isPrimary = emphasis === 'primary';

  const anim = useAnimatedStyle(() => ({
    // Primary squeezes to 0.95 so the spring's overshoot is actually visible —
    // at 0.97 the bounce is a rounding error. Secondary stays shallow on purpose.
    transform: [{ scale: 1 - p.value * (isPrimary ? 0.05 : 0.03) }],
    backgroundColor: isPrimary ? fill : interpolateColor(p.value, [0, 1], [fill, t.bgTer]),
  }));

  return (
    <View style={[styles.grow, { paddingRight: reserve, paddingBottom: reserve }]}>
    <Animated.View style={[styles.btnWrap, anim, style]}>
      <Pressable
        onPressIn={() => {
          if (!reduce && !disabled) p.value = withTiming(1, { duration: 70 });
        }}
        onPressOut={() => {
          if (reduce || disabled) return;
          p.value = isPrimary
            ? withSpring(0, { damping: 13, stiffness: 240, mass: 1 })
            : withTiming(0, { duration: 130 });
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
        style={styles.btnInner}
      >
        {children}
      </Pressable>
    </Animated.View>
    </View>
  );
}

// Control bar pinned in the bottom thumb zone (blueprint #5). Translucent fill
// instead of BlurView (cheap on Android; blueprint allows rgba).
//
// Two flows share the bar:
//   • Normal (Strava-style): while reading, a single full-width PAUSE. Pausing
//     reveals RESUME + FINISH — finishing lives in the paused state, so the two
//     never crowd the running screen.
//   • Focus mode (showPause=false): a committed block — one Finish that stays
//     locked with a countdown until the chosen duration elapses, long-pressable
//     to end early. Never hidden, so it stays reachable to screen readers.
//
// There is no cancel here any more (removed 2026-08-08). A mis-started session is
// dropped from the Review screen's Discard instead, which is the same outcome and
// keeps a destructive control off the live session bar.
export function SessionControlBar({
  isPaused,
  canStop,
  stopUnlocksInSec = 0,
  showPause = true,
  onEndEarly,
  onTogglePause,
  onStop,
}: SessionControlBarProps) {
  const t = useTheme();

  // ── Focus mode: a single locked Finish (countdown + hold-to-end-early) ────────
  if (!showPause) {
    const focusLocked = !canStop && stopUnlocksInSec > 0;
    const lockedLabel = stopUnlocksInSec > 0 ? `FINISH IN ${formatLock(stopUnlocksInSec)}` : 'RESUME TO FINISH';
    return (
      <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
        <BarButton
          onPress={() => {
            if (!canStop) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onStop();
          }}
          onLongPress={
            focusLocked && onEndEarly
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onEndEarly();
                }
              : undefined
          }
          delayLongPress={600}
          disabled={!canStop && !focusLocked}
          // Only a Finish you can actually press is the primary action.
          emphasis={canStop ? 'primary' : 'secondary'}
          fill={canStop ? t.accent : t.bgTer}
          reserve={SHADOW_OFFSET}
          style={[{ borderColor: t.border }, !canStop && styles.locked]}
          accessibilityLabel={canStop ? 'Stop and finish session' : lockedLabel}
          accessibilityHint={focusLocked ? 'Press and hold to end your focus session early and finish' : undefined}
          accessibilityState={{ disabled: !canStop && !focusLocked }}
        >
          {canStop ? (
            <>
              <Ionicons name="stop" size={20} color={t.onAccent} />
              <Text style={[styles.btnText, { color: t.onAccent }]}>FINISH</Text>
            </>
          ) : (
            <View style={styles.lockedCol}>
              <Text style={[styles.lockedText, { color: t.textSec }]}>{lockedLabel}</Text>
              {focusLocked ? <Text style={[styles.holdHint, { color: t.textTer }]}>HOLD TO END EARLY</Text> : null}
            </View>
          )}
        </BarButton>
      </View>
    );
  }

  // ── Normal mode: PAUSE while running → RESUME + FINISH while paused ────────────
  return (
    <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
      {!isPaused ? (
        <BarButton
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTogglePause();
          }}
          // Pausing is an interruption, not the goal — it stays secondary.
          fill={t.bgSec}
          reserve={SHADOW_OFFSET}
          style={{ borderColor: t.border }}
          accessibilityLabel="Pause session"
        >
          <Ionicons name="pause" size={22} color={t.text} />
          <Text style={[styles.btnText, { color: t.text }]}>PAUSE</Text>
        </BarButton>
      ) : (
        <>
          {/* Getting back to reading is what this screen is for, so RESUME is a
              real block button — it presses into its own shadow like every other
              primary CTA. offset 3 rather than the default 4 so it doesn't compete
              with the bar's own 4px shadow it's sitting inside. PressBlock fires
              the haptic itself. */}
          <PressBlock
            emphasis="primary"
            offset={SHADOW_OFFSET}
            radius={14}
            haptic="light"
            onPress={onTogglePause}
            accessibilityLabel="Resume session"
            containerStyle={styles.grow}
            style={[styles.blockFace, { backgroundColor: t.accent, borderColor: t.border }]}
          >
            <Ionicons name="play" size={22} color={t.onAccent} />
            <Text style={[styles.btnText, { color: t.onAccent }]}>RESUME</Text>
          </PressBlock>
          <BarButton
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onStop();
            }}
            fill={t.bgSec}
            reserve={SHADOW_OFFSET}
            style={{ borderColor: t.border }}
            accessibilityLabel="Stop and finish session"
          >
            <Ionicons name="stop" size={20} color={t.text} />
            <Text style={[styles.btnText, { color: t.text }]}>FINISH</Text>
          </BarButton>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH_THICK,
    ...SHADOW.card,
  },
  // The animated wrapper carries the fill, border and flex; the Pressable inside
  // it carries the row layout so the whole face stays the touch target.
  grow: { flex: 1 },
  btnWrap: { borderRadius: 14, borderWidth: BORDER_WIDTH, overflow: 'hidden' },
  blockFace: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 52, borderRadius: 14, borderWidth: BORDER_WIDTH,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8 },
  locked: { opacity: 0.7 },
  lockedCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  lockedText: { fontFamily: FONTS.monoMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  holdHint: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8 },
});
