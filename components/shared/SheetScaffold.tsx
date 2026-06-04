import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, RADIUS } from '@/theme/tokens';

interface SheetScaffoldProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Hide the default header (title + close) when a screen wants full control. */
  hideHeader?: boolean;
}

// Bottom-sheet chrome shared by the library modals (add-book, review,
// filter-sort). A plain dimmed scrim backdrop (no blur) closes on tap. The whole
// sheet is wrapped in a KeyboardAvoidingView so a focused input lifts the panel
// above the keyboard instead of being covered.
export function SheetScaffold({ title, onClose, children, hideHeader = false }: SheetScaffoldProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const isDark = t.mode === 'dark';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(3,4,6,0.62)' : 'rgba(17,19,24,0.4)' }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
      />
      <Animated.View
        entering={reduce ? undefined : SlideInDown.duration(300)}
        style={[styles.sheet, { backgroundColor: t.bgSec, borderColor: t.border, paddingBottom: insets.bottom + 16 }]}
      >
        <View style={[styles.handle, { backgroundColor: t.bgTer }]} />
        {!hideHeader ? (
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, { backgroundColor: t.bgTer }]}
            >
              <Ionicons name="close" size={20} color={t.text} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: FONTS.uiBold, fontSize: 20 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
