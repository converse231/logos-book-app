import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

// Reading Insights history — reads: reading_insights. Deep link: quire://insights.
// F4 implementation.
export default function Insights() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Reading Insights</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>F4 — insights history list</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
});
