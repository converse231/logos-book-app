import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  SlideInDown,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK, RADIUS } from '@/theme/tokens';

interface SheetScaffoldProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Hide the default header (title + close) when a screen wants full control. */
  hideHeader?: boolean;
  /** Wrap the content in a ScrollView so long forms (e.g. a long review) stay
   *  fully reachable and scrollable above the keyboard. Leave off for sheets that
   *  manage their own list/scroll (add-book, filter-sort). */
  scroll?: boolean;
}

// Bottom-sheet chrome shared by the library modals (add-book, review,
// filter-sort, goal-edit, feedback). A plain dimmed scrim (no blur) closes on tap.
// Keyboard avoidance is driven by Reanimated's useAnimatedKeyboard — the sheet is
// lifted by the live keyboard height on BOTH iOS and Android. This is the reliable
// cross-platform path in Expo Go: a plain KeyboardAvoidingView is a no-op on
// Android, and app.json's softwareKeyboardLayoutMode doesn't apply inside Expo Go
// (and never resizes a transparent modal window anyway). With `scroll`, content
// also scrolls inside the height-capped sheet so a long form never strands its
// submit button under the keyboard.
export function SheetScaffold({ title, onClose, children, hideHeader = false, scroll = false }: SheetScaffoldProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const isDark = t.mode === 'dark';
  const keyboard = useAnimatedKeyboard();

  // Lift the whole (flex-end) sheet by the keyboard height. Padding on the root
  // pushes the anchored sheet up without disturbing the full-screen scrim.
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));

  const body = scroll ? (
    <ScrollView
      style={styles.scrollBody}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Animated.View style={[styles.root, liftStyle]}>
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
              style={[styles.closeBtn, { backgroundColor: t.bgTer, borderColor: t.border }]}
            >
              <Ionicons name="close" size={20} color={t.text} />
            </Pressable>
          </View>
        ) : null}
        {body}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 0,
    borderTopWidth: BORDER_WIDTH_THICK,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
  },
  // flexShrink lets the ScrollView collapse (and scroll) once the sheet hits its
  // maxHeight, instead of pushing the submit button off the bottom.
  scrollBody: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 14, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: FONTS.uiBold, fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: { width: 34, height: 34, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
});
