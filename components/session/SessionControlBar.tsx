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

// Glass control bar pinned in the bottom thumb zone (blueprint #5). Translucent
// fill instead of BlurView (cheap on Android; blueprint allows rgba). A short-lived
// Cancel (danger) sits on the left during the opening seconds so a mis-started
// session leaves no trace.
//
// Two flows share the bar:
//   • Normal (Strava-style): while reading, a single full-width PAUSE. Pausing
//     reveals RESUME + FINISH — finishing lives in the paused state, so the two
//     never crowd the running screen.
//   • Focus mode (showPause=false): a committed block — one Finish that stays
//     locked with a countdown until the chosen duration elapses, long-pressable
//     to end early. Never hidden, so it stays reachable to screen readers.
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

  const cancelBtn =
    showCancel && onCancel ? (
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
    ) : null;

  // ── Focus mode: a single locked Finish (countdown + hold-to-end-early) ────────
  if (!showPause) {
    const focusLocked = !canStop && stopUnlocksInSec > 0;
    const lockedLabel = stopUnlocksInSec > 0 ? `FINISH IN ${formatLock(stopUnlocksInSec)}` : 'RESUME TO FINISH';
    return (
      <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
        {cancelBtn}
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
          style={[styles.btn, { backgroundColor: canStop ? t.accent : t.bgTer, borderColor: t.border }, !canStop && styles.locked]}
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
        </Pressable>
      </View>
    );
  }

  // ── Normal mode: PAUSE while running → RESUME + FINISH while paused ────────────
  return (
    <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
      {cancelBtn}
      {!isPaused ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTogglePause();
          }}
          accessibilityRole="button"
          accessibilityLabel="Pause session"
          style={[styles.btn, { borderColor: t.border }]}
        >
          <Ionicons name="pause" size={22} color={t.text} />
          <Text style={[styles.btnText, { color: t.text }]}>PAUSE</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTogglePause();
            }}
            accessibilityRole="button"
            accessibilityLabel="Resume session"
            style={[styles.btn, { backgroundColor: t.accent, borderColor: t.border }]}
          >
            <Ionicons name="play" size={22} color={t.onAccent} />
            <Text style={[styles.btnText, { color: t.onAccent }]}>RESUME</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onStop();
            }}
            accessibilityRole="button"
            accessibilityLabel="Stop and finish session"
            style={[styles.btn, { backgroundColor: t.bgSec, borderColor: t.border }]}
          >
            <Ionicons name="stop" size={20} color={t.text} />
            <Text style={[styles.btnText, { color: t.text }]}>FINISH</Text>
          </Pressable>
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
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  // Shared button face: fills the bar (flex), fill/border set inline per action.
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, letterSpacing: 0.8 },
  locked: { opacity: 0.7 },
  lockedCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  lockedText: { fontFamily: FONTS.monoMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  holdHint: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.8 },
});
