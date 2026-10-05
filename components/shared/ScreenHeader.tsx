import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, RADIUS } from '@/theme/tokens';

/*
 * The header for every pushed screen: a bordered back button, a centred title,
 * and an optional action on the right that mirrors the back button's footprint so
 * the title stays optically centred.
 *
 * This replaced six hand-rolled variants — a large left-aligned serif (TBR), a
 * bare chevron over tiny uppercase mono (moderation), an uppercase display title
 * (browse), and three near-identical copies that still disagreed on border width
 * (1 vs 2). Tab ROOTS (Home, Library, Stats, More, Discover) keep their large
 * serif page titles; this is only for screens you arrive at by pushing.
 *
 * It does not add a top inset: callers render it inside different containers
 * (scroll content, list headers, fixed bars), so the inset belongs to them.
 */
interface ScreenHeaderProps {
  title: string;
  /** One quiet line under the title — a count, a date. */
  subtitle?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  /** A 42dp action. Omit and an invisible spacer keeps the title centred. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const HEADER_BUTTON = 42;

export function ScreenHeader({ title, subtitle, onBack, right, style }: ScreenHeaderProps) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.bar, style]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: t.bgSec, borderColor: t.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={t.text} />
      </Pressable>
      <View style={styles.titleBlock} accessibilityRole="header">
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.textSec }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HEADER_BUTTON },
  button: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { fontFamily: FONTS.uiBold, fontSize: 18 },
  subtitle: { fontFamily: FONTS.mono, fontSize: 12, marginTop: 1 },
  spacer: { width: HEADER_BUTTON, height: HEADER_BUTTON },
});
