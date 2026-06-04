import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface SessionControlBarProps {
  isPaused: boolean;
  canStop: boolean;
  stopUnlocksInSec?: number;
  onTogglePause: () => void;
  onStop: () => void;
}

// Glass control bar pinned in the bottom thumb zone (blueprint #5). Stop is
// locked for the first 2 minutes to prevent accidental aborts; while locked it
// shows a countdown and stays a real (disabled) target — never hidden, so it
// remains reachable to screen readers. Translucent fill instead of BlurView
// (cheap on Android; blueprint allows rgba).
export function SessionControlBar({
  isPaused,
  canStop,
  stopUnlocksInSec = 0,
  onTogglePause,
  onStop,
}: SessionControlBarProps) {
  const t = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.border }]}>
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
          {isPaused ? 'Resume' : 'Pause'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          if (!canStop) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onStop();
        }}
        disabled={!canStop}
        accessibilityRole="button"
        accessibilityLabel={canStop ? 'Stop and finish session' : `Stop available in ${stopUnlocksInSec} seconds`}
        accessibilityState={{ disabled: !canStop }}
        style={[styles.stop, { backgroundColor: canStop ? t.accent : t.bgTer }, !canStop && styles.stopLocked]}
      >
        {canStop ? (
          <>
            <Ionicons name="stop" size={20} color="#FFFFFF" />
            <Text style={styles.stopText}>Finish</Text>
          </>
        ) : (
          <Text style={[styles.lockedText, { color: t.textSec }]}>
            Finish in {stopUnlocksInSec}s
          </Text>
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
    borderRadius: 20,
    borderWidth: 1,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  stop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
  },
  stopLocked: { opacity: 0.7 },
  stopText: { fontFamily: FONTS.uiBold, fontSize: 16, color: '#FFFFFF' },
  lockedText: { fontFamily: FONTS.uiMedium, fontSize: 14, fontVariant: ['tabular-nums'] },
});
