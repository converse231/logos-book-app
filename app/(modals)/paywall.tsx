import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

// RevenueCat paywall — Phase 4. Deep link: quire://upgrade.
export default function Paywall() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Upgrade to Quire Pro</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>Phase 4 — RevenueCat paywall</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
});
