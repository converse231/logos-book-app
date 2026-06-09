import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/services/ApiContext';
import { useTheme } from '@/theme/ThemeContext';
import { BORDER_WIDTH_THICK } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

// Raised center action on the tab bar (Strava / Duolingo pattern): the core
// habit — start a reading session — is one tap from anywhere in the app. Floats
// above the tab bar's centre line; with the active book it deep-links straight
// into the tracker (which now opens on a confirmation screen, never auto-start),
// otherwise routes to the library to pick one. Uses the shared PressBlock so it
// presses into its hard shadow exactly like every other block button.
export function SessionFab() {
  const router = useRouter();
  const api = useApi();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

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
      <PressBlock
        onPress={onPress}
        haptic="none"
        accessibilityLabel="Start a reading session"
        hitSlop={10}
        style={[styles.fab, { backgroundColor: t.accent, borderColor: t.border }]}
      >
        {loading ? (
          <ActivityIndicator color={t.onAccent} />
        ) : (
          <Ionicons name="play" size={26} color={t.onAccent} style={styles.glyph} />
        )}
      </PressBlock>
    </View>
  );
}

const FAB_SIZE = 62;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 0,
    borderWidth: BORDER_WIDTH_THICK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // play glyph reads optically centred when nudged right a hair
  glyph: { marginLeft: 3 },
});
