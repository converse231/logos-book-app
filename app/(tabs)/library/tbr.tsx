import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { BookGridCard } from '@/components/library/BookGridCard';

// To Be Read — books already owned but not yet started (user_books status='tbr').
// Distinct from the wishlist ("Want" — don't own it yet).
export default function TBR() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [books, setBooks] = useState<UserBook[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      api.getUserBooks('tbr')
        .then((b) => alive && setBooks(b))
        .catch(() => alive && setError(true));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  const cellWidth = (width - 36 - 16) / 2;

  return (
    <ScreenBackground>
      {error && !books ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : books === null ? (
        <View style={[styles.content, { paddingTop: insets.top + 6 }]}>
          <View style={styles.header}>
            <Skeleton width={42} height={42} radius={21} />
            <Skeleton width={150} height={28} />
          </View>
          <View style={styles.skelGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ width: cellWidth, gap: 6 }}>
                <Skeleton width={cellWidth} height={cellWidth / 0.66} radius={8} />
                <Skeleton width={cellWidth * 0.9} height={12} />
                <Skeleton width={cellWidth * 0.6} height={10} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={[styles.roundBtn, { backgroundColor: t.bgSec, borderColor: t.border }]}
              >
                <Ionicons name="chevron-back" size={22} color={t.text} />
              </Pressable>
              <View style={styles.titleText}>
                <Text style={[styles.title, { color: t.text }]}>To Be Read</Text>
                <Text style={[styles.count, { color: t.textSec }]}>
                  {books.length} {books.length === 1 ? 'book' : 'books'} waiting
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <BookGridCard
              userBook={item}
              width={cellWidth}
              onPress={() => router.push(`/(tabs)/library/${item.id}` as Href)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: t.bgSec, borderColor: t.border }]}>
                <Ionicons name="bookmarks-outline" size={26} color={t.textSec} />
              </View>
              <Text style={[styles.emptyTitle, { color: t.text }]}>Nothing on the list yet</Text>
              <Text style={[styles.emptyBody, { color: t.textSec }]}>
                Mark books as &ldquo;TBR&rdquo; and they will line up here.
              </Text>
            </View>
          }
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 18 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  column: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleText: { gap: 1 },
  title: { fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 34 },
  count: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 56, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONTS.uiBold, fontSize: 19 },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
