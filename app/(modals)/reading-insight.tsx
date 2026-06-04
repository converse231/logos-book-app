import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

// ReadingInsightCard overlay — 200pt slide-up, 6s auto-dismiss, swipe-up to save.
// Appears after share-card preview on session-complete screen (timeline 2000ms).
// F2 implementation.
export default function ReadingInsight() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.overlay }]}>
      <Text style={[styles.label, { color: t.text }]}>Reading Insight 💡</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>F2 — slide-up card, 6s dismiss</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
  overlay: { backgroundColor: 'rgba(0,0,0,0.60)' },
});
