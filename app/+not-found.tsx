import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';

export default function NotFound() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>Page not found</Text>
      <Pressable onPress={() => router.replace('/(tabs)/home' as Href)}>
        <Text style={[styles.link, { color: t.accent }]}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 18, fontWeight: '600' },
  link: { fontSize: 16 },
});
