import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { ANIMATION, FONTS } from '@/theme/tokens';
import { SessionFab } from '@/components/navigation/SessionFab';

type IconName = keyof typeof Ionicons.glyphMap;

// Active state = accent glyph + a tinted pill that springs in behind it (state
// transition, reduced-motion gated). Filled glyph when focused, outline when not
// — never colour alone.
function TabIcon({
  name,
  focused,
  color,
  accentMuted,
}: {
  name: IconName;
  focused: boolean;
  color: string;
  accentMuted: string;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    p.value = reduce
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: ANIMATION.durationQuick });
  }, [focused, reduce, p]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.82 + p.value * 0.18 }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.iconPill, pillStyle, { backgroundColor: accentMuted }]} />
      <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={22} color={color} />
    </View>
  );
}

// Bottom tab bar: Home · Library · [Record] · Discover · More. The centre slot
// is a non-interactive spacer that reserves space for the raised gradient FAB
// (the core "record a session" action) so it never overlaps a real tab. Stats
// and Profile are kept routable (href: null) and surfaced from the More hub.
// Height accounts for the home indicator via the safe-area inset.
export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: t.bgSec,
            borderTopColor: t.border,
            borderTopWidth: 2,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
          },
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.textSec,
          tabBarLabelStyle: { fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2, includeFontPadding: false },
          tabBarItemStyle: { paddingTop: 2 },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="home" focused={focused} color={color} accentMuted={t.accentMuted} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="library" focused={focused} color={color} accentMuted={t.accentMuted} />
            ),
          }}
        />
        {/* Centre spacer — reserves the slot the floating FAB sits over. */}
        <Tabs.Screen
          name="record"
          options={{
            title: '',
            tabBarButton: () => <View style={styles.spacer} pointerEvents="none" />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="compass" focused={focused} color={color} accentMuted={t.accentMuted} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="ellipsis-horizontal-circle" focused={focused} color={color} accentMuted={t.accentMuted} />
            ),
          }}
        />
        {/* Routable but off the bar — reached from the More hub. */}
        <Tabs.Screen name="stats" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      <SessionFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  iconWrap: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconPill: { position: 'absolute', width: 52, height: 30, borderRadius: 14 },
  spacer: { flex: 1 },
});
