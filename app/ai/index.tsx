import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

// AI conversational recs — Phase 3. Deep link: logos://ai.
// AiChatBubble: 20ms/char reveal, typing indicator.
export default function AI() {
  const t = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Logos AI</Text>
      <Text style={[styles.sub, { color: t.textSec }]}>Phase 3 — Claude recs chat</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14 },
});
