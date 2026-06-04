import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

// Backdate session sheet — date/time/page pickers.
// Calls completeSession with source='backdated'.
// F2 implementation.
export default function BackdateSession() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Backdate Session</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>F2 — date/time/page pickers</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
});
