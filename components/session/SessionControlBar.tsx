import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';

interface SessionControlBarProps {
  isPaused: boolean;
  canStop: boolean;
  stopUnlocksInSec?: number;
  /** Show the "cancel session" affordance (only in the opening window — a mistaken
   *  start can be dropped without ever recording a session). */
  showCancel?: boolean;
  /** Pause is hidden in focus mode (a committed, un-pausable session). */
  showPause?: boolean;
  /** Long-press escape while a focus block is still locked — ends early and
   *  finishes (records) the session. Only wired during the focus countdown. */
  onEndEarly?: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onCancel?: () => void;
}

// Locked-finish countdown: seconds for a short wait, m:ss once it's a minute+.
function formatLock(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Glass control bar pinned in the bottom thumb zone (blueprint #5). Stop is
// locked for the first 2 minutes to prevent accidental aborts; while locked it
// shows a countdown and stays a real (disabled) target — never hidden, so it
// remains reachable to screen readers. Translucent fill instead of BlurView
// (cheap on Android; blueprint allows rgba). A short-lived Cancel (danger) sits
// on the left during the opening seconds so a mis-started session leaves no trace.
export function SessionControlBar({
  isPaused,
  canStop,
  stopUnlocksInSec = 0,
  showCancel = false,
  showPause = true,
  onEndEarly,
  onTogglePause,
  onStop,
  onCancel,
}: SessionControlBarProps) {
  const t = useTheme();
  // Locked because a focus commitment is still counting down, vs. because the
  // session is paused — the two need different messaging.
  const lockedLabel = stopUnlocksInSec > 0 ? `FINISH IN ${formatLock(stopUnlocksInSec)}` : 'RESUME TO FINISH';
  // Focus block still running: not tappable to finish, but long-pressable to bail.
  const focusLocked = !canStop && stopUnlocksInSec > 0;

  return (
    <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
      {showCancel && onCancel ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCancel();
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel session without saving"
          style={[styles.cancel, { borderColor: t.danger }]}
        >
          <Ionicons name="close" size={24} color={t.danger} />
        </Pressable>
      ) : null}

      {showPause ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTogglePause();
          }}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume session' : 'Pause session'}
          style={[styles.secondary, { borderColor: t.border }]}
        >
          <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color={t.text} />
          <Text style={[styles.secondaryText, { color: t.text }]}>
            {isPaused ? 'RESUME' : 'PAUSE'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
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
        accessibilityRole="button"
        accessibilityLabel={canStop ? 'Stop and finish session' : lockedLabel}
        accessibilityHint={focusLocked ? 'Press and hold to end your focus session early and finish' : undefined}
        accessibilityState={{ disabled: !canStop && !focusLocked }}
        style={[styles.stop, { backgroundColor: canStop ? t.accent : t.bgTer, borderColor: t.border }, !canStop && styles.stopLocked]}
      >
        {canStop ? (
          <>
            <Ionicons name="stop" size={20} color={t.onAccent} />
            <Text style={[styles.stopText, { color: t.onAccent }]}>FINISH</Text>
          </>
        ) : (
          <View style={styles.lockedCol}>
            <Text style={[styles.lockedText, { color: t.textSec }]}>{lockedLabel}</Text>
            {focusLocked ? (
              <Text style={[styles.holdHint, { color: t.textTer }]}>HOLD TO END EARLY</Text>
            ) : null}
          </View>
        )}
      </Pressable>
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
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  secondaryText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
  stop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  stopLocked: { opacity: 0.7 },
  stopText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8 },
  lockedCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  lockedText: { fontFamily: FONTS.monoMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  holdHint: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8 },
});
