import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export default function SignIn() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Sign In</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>F1 — to be built</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
});
