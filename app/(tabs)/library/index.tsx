import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ReadingStatus, UserBook } from '@/services/types';
import { ScreenBackground } from '@/components/shared/ScreenBackground';
import { Skeleton } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { BookGridCard } from '@/components/library/BookGridCard';
import { getBookProgress } from '@/components/library/bookProgress';
import { useLibraryStore, isLibraryFilterActive } from '@/stores/libraryStore';

type StatusTab = 'all' | ReadingStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
  { key: 'want', label: 'Want' },
  { key: 'dnf', label: 'DNF' },
];

// Library shelf (blueprint Section 3). Two-column grid of the user's books with
// status tabs, a bottom-anchored search in the thumb zone, and a filter/sort
// sheet. Search filters the shelf locally; the add / scan affordances open the
// catalog flows. Deep link: logos://library
export default function Library() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const [books, setBooks] = useState<UserBook[] | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const sort = useLibraryStore((s) => s.sort);
  const formatFilter = useLibraryStore((s) => s.formatFilter);
  const favoritesOnly = useLibraryStore((s) => s.favoritesOnly);
  const filterActive = useLibraryStore((s) => isLibraryFilterActive(s));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setError(false);
      api.getUserBooks()
        .then((b) => alive && setBooks(b))
        .catch(() => alive && setError(true));
      return () => {
        alive = false;
      };
    }, [api, nonce])
  );

  const cellWidth = (width - 36 - 16) / 2; // 18px gutters, 16px column gap

  const visible = useMemo(() => {
    if (!books) return [];
    const q = query.trim().toLowerCase();
    let list = books.filter((b) => {
      if (statusTab !== 'all' && b.status !== statusTab) return false;
      if (formatFilter !== 'all' && b.format !== formatFilter) return false;
      if (favoritesOnly && !b.isFavorite) return false;
      if (q) {
        const hay = `${b.book.title} ${b.book.authors.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list];
    if (sort === 'title') list.sort((a, b) => a.book.title.localeCompare(b.book.title));
    else if (sort === 'author')
      list.sort((a, b) => (a.book.authors[0] ?? '').localeCompare(b.book.authors[0] ?? ''));
    else if (sort === 'progress')
      list.sort((a, b) => getBookProgress(b).pct - getBookProgress(a).pct);
    return list;
  }, [books, statusTab, query, sort, formatFilter, favoritesOnly]);

  const goDetail = (id: string) => router.push(`/(tabs)/library/${id}` as Href);

  const Header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={[styles.title, { color: t.text }]}>Library</Text>
          <Text style={[styles.count, { color: t.textSec }]}>
            {books ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : ' '}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconBtn icon="scan-outline" label="Scan a book" onPress={() => router.push('/(modals)/scanner' as Href)} t={t} />
          <IconBtn icon="add" label="Add a book" onPress={() => router.push('/(modals)/add-book' as Href)} t={t} primary />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {STATUS_TABS.map((tab) => {
          const active = tab.key === statusTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.selectionAsync();
                setStatusTab(tab.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? t.accent : t.textSec }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ScreenBackground>
      {error && !books ? (
        <ErrorState onRetry={() => setNonce((n) => n + 1)} />
      ) : books === null ? (
        <SkeletonGrid cellWidth={cellWidth} topInset={insets.top + 8} />
      ) : (
        <Animated.View style={styles.flex} entering={reduce ? undefined : FadeIn.duration(300)}>
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            numColumns={2}
            ListHeaderComponent={Header}
            columnWrapperStyle={styles.column}
            contentContainerStyle={[
              styles.content,
              { paddingTop: insets.top + 8, paddingBottom: 104 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <BookGridCard userBook={item} width={cellWidth} onPress={() => goDetail(item.id)} />
            )}
            ListEmptyComponent={
              <EmptyState
                t={t}
                shelfEmpty={books.length === 0}
                onAdd={() => router.push('/(modals)/add-book' as Href)}
              />
            }
          />
        </Animated.View>
      )}

      {/* Bottom-anchored search (thumb zone), lifted above the centre FAB.
          Hidden until the shelf has loaded — searching nothing is pointless. */}
      {books ? (
        <View style={[styles.searchDock, { bottom: 24 }]} pointerEvents="box-none">
          <View style={[styles.searchBar, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Ionicons name="search" size={18} color={t.textSec} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your library"
              placeholderTextColor={t.textTer}
              style={[styles.searchInput, { color: t.text }]}
              returnKeyType="search"
              accessibilityLabel="Search your library"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={t.textTer} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.push('/(modals)/filter-sort' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort"
            style={[styles.filterBtn, { backgroundColor: t.bgSec, borderColor: filterActive ? t.accent : t.border }]}
          >
            <Ionicons name="options-outline" size={20} color={filterActive ? t.accent : t.text} />
            {filterActive ? <View style={[styles.filterDot, { backgroundColor: t.accent, borderColor: t.bgSec }]} /> : null}
          </Pressable>
        </View>
      ) : null}
    </ScreenBackground>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  t,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          backgroundColor: primary ? t.accent : t.bgSec,
          borderColor: primary ? t.accent : t.border,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={20} color={primary ? t.onAccent : t.text} />
    </Pressable>
  );
}

function EmptyState({
  t,
  shelfEmpty,
  onAdd,
}: {
  t: ReturnType<typeof useTheme>;
  shelfEmpty: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.bgSec, borderColor: t.border }]}>
        <Ionicons name={shelfEmpty ? 'book-outline' : 'search-outline'} size={28} color={t.textSec} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>
        {shelfEmpty ? 'Your shelf is empty' : 'Nothing matches'}
      </Text>
      <Text style={[styles.emptyBody, { color: t.textSec }]}>
        {shelfEmpty
          ? 'Add a book to start tracking sessions, streaks, and pages read.'
          : 'Try a different tab, clear your search, or reset the filters.'}
      </Text>
      {shelfEmpty ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add your first book"
          style={[styles.emptyCta, { backgroundColor: t.accent }]}
        >
          <Ionicons name="add" size={18} color={t.onAccent} />
          <Text style={[styles.emptyCtaText, { color: t.onAccent }]}>Add your first book</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SkeletonGrid({ cellWidth, topInset }: { cellWidth: number; topInset: number }) {
  return (
    <View style={[styles.content, { paddingTop: topInset }]}>
      <View style={styles.titleRow}>
        <Skeleton width={120} height={30} />
      </View>
      <View style={styles.skelGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ width: cellWidth, gap: 6 }}>
            <Skeleton width={cellWidth} height={cellWidth / 0.66} radius={8} />
            <Skeleton width={cellWidth * 0.9} height={12} />
            <Skeleton width={cellWidth * 0.6} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },
  column: { gap: 16 },
  header: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  titleText: { gap: 1 },
  title: { fontFamily: FONTS.displayBold, fontSize: 32, lineHeight: 36 },
  count: { fontFamily: FONTS.uiMedium, fontSize: 13 },
  headerActions: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 8, paddingRight: 18 },
  tab: { paddingHorizontal: 16, height: 36, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },

  searchDock: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', gap: 10 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    ...({ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 } as const),
  },
  searchInput: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 15, padding: 0 },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    ...({ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 } as const),
  },
  filterDot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },

  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 56, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONTS.uiBold, fontSize: 19 },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, height: 48, borderRadius: 14, marginTop: 6 },
  emptyCtaText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },

  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
