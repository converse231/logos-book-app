import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/services/ApiContext';
import { ANIMATION, PALETTE } from '@/theme/tokens';

// Raised center action on the tab bar (Strava / Duolingo pattern): the core
// habit — start a reading session — is one tap from anywhere in the app. Floats
// above the tab bar's centre line; with the active book it deep-links straight
// into the tracker (which now opens on a confirmation screen, never auto-start),
// otherwise routes to the library to pick one.
export function SessionFab() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(false);

  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const home = await api.getHomeData();
      if (home.activeBook) {
        router.push(`/session/${home.activeBook.id}` as Href);
      } else {
        router.push('/(tabs)/library' as Href);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <Animated.View style={style}>
        <Pressable
          onPressIn={() =>
            !reduce && (scale.value = withTiming(0.92, { duration: ANIMATION.durationFast }))
          }
          onPressOut={() => !reduce && (scale.value = withSpring(1, ANIMATION.springSnappy))}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Start a reading session"
          hitSlop={10}
        >
          <View style={styles.glow} pointerEvents="none" />
          <LinearGradient
            colors={[PALETTE.accentGradStart, PALETTE.accentGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            {loading ? (
              <ActivityIndicator color={PALETTE.onAccent} />
            ) : (
              <Ionicons name="play" size={26} color={PALETTE.onAccent} style={styles.glyph} />
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const FAB_SIZE = 62;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  glow: {
    position: 'absolute',
    top: 6,
    left: 4,
    right: 4,
    bottom: -6,
    borderRadius: FAB_SIZE,
    backgroundColor: PALETTE.accentAlpha18,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...({
      shadowColor: PALETTE.accent,
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    } as const),
  },
  // play glyph reads optically centred when nudged right a hair
  glyph: { marginLeft: 3 },
});
