import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { UserProfile } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Card } from '@/components/shared/Card';
import { LevelNameBadge } from '@/components/shared/LevelNameBadge';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  href: Href;
  tint?: 'accent' | 'gold';
}

const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Your reading',
    items: [
      { icon: 'bar-chart', label: 'Stats', sub: 'Heatmap, pace, lifetime totals', href: '/(tabs)/stats' as Href },
      { icon: 'flag', label: 'Reading goal', sub: 'Set your target for the year', href: '/(modals)/goal-edit' as Href, tint: 'gold' },
      { icon: 'bookmarks', label: 'To be read', sub: 'Books you own, not started yet', href: '/(tabs)/library/tbr' as Href },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: 'person', label: 'Profile', sub: 'Achievements and identity', href: '/(tabs)/profile' as Href },
      { icon: 'settings', label: 'Settings', sub: 'Theme, notifications, privacy', href: '/(tabs)/profile/settings' as Href },
    ],
  },
  {
    title: 'Feedback',
    items: [
      { icon: 'chatbubble-ellipses', label: 'Send feedback', sub: 'Bugs, ideas, or anything on your mind', href: '/(modals)/feedback?kind=feedback' as Href },
    ],
  },
];

// More hub — the overflow destination for everything that isn't a primary tab.
export default function More() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getProfile().then((p) => alive && setProfile(p));
      return () => {
        alive = false;
      };
    }, [api])
  );

  const signOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await api.signOut();
    router.replace('/(auth)/sign-in' as Href);
  };

  const initials = (profile?.displayName ?? 'R').trim().charAt(0).toUpperCase();

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: t.text }]}>More</Text>

        {/* Identity */}
        <Reveal i={0} reduce={reduce}>
          <Pressable onPress={() => router.push('/(tabs)/profile' as Href)} accessibilityRole="button" accessibilityLabel="Open profile">
            <Card padded glow style={styles.identity}>
              <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.accent }]}>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={[styles.avatarText, { color: t.accent }]}>{initials}</Text>
                )}
              </View>
              <View style={styles.identityInfo}>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                  {profile?.displayName ?? 'Reader'}
                </Text>
                {profile?.username ? (
                  <Text style={[styles.handle, { color: t.textSec }]} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                ) : null}
                {profile ? (
                  <View style={styles.badgeWrap}>
                    <LevelNameBadge levelName={profile.levelName} context="home" size="sm" />
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.textTer} />
            </Card>
          </Pressable>
        </Reveal>

        {GROUPS.map((group, gi) => (
          <Reveal i={gi + 1} reduce={reduce} key={group.title}>
            <View style={styles.group}>
              <Text style={[styles.groupTitle, { color: t.textSec }]}>{group.title}</Text>
              <Card padded={false}>
                {group.items.map((item, idx) => (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(item.href);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [
                      styles.row,
                      idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                      pressed && { backgroundColor: t.bgTer },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconChip,
                        { backgroundColor: item.tint === 'gold' ? 'rgba(255,197,61,0.14)' : t.accentMuted },
                      ]}
                    >
                      <Ionicons name={item.icon} size={19} color={item.tint === 'gold' ? t.gold : t.accent} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: t.text }]}>{item.label}</Text>
                      <Text style={[styles.rowSub, { color: t.textSec }]} numberOfLines={1}>
                        {item.sub}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.textTer} />
                  </Pressable>
                ))}
              </Card>
            </View>
          </Reveal>
        ))}

        <Reveal i={GROUPS.length + 1} reduce={reduce}>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOut,
              { backgroundColor: 'rgba(217,48,37,0.10)', borderColor: 'rgba(217,48,37,0.30)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color={t.danger} />
            <Text style={[styles.signOutText, { color: t.danger }]}>Sign out</Text>
          </Pressable>
        </Reveal>
      </ScrollView>
    </ScreenBackground>
  );
}

// Module-level so the menu groups don't re-animate when the profile loads in.
function Reveal({ i, reduce, children }: { i: number; reduce: boolean; children: React.ReactNode }) {
  if (reduce) return <View>{children}</View>;
  return <Animated.View entering={FadeInUp.delay(i * 70).duration(420)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 },
  title: { fontFamily: FONTS.displayBold, fontSize: 32, lineHeight: 36 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontFamily: FONTS.uiBold, fontSize: 22 },
  identityInfo: { flex: 1, gap: 3 },
  name: { fontFamily: FONTS.displayBold, fontSize: 22, lineHeight: 26 },
  handle: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  badgeWrap: { flexDirection: 'row', marginTop: 4 },
  group: { gap: 10 },
  groupTitle: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 0.6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  iconChip: { width: 40, height: 40, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 16 },
  rowSub: { fontFamily: FONTS.uiRegular, fontSize: 13 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 0, borderWidth: 1, marginTop: 4 },
  signOutText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
});
