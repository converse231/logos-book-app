import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import {
  FORMAT_LABELS,
  FormatFilter,
  LibrarySort,
  SORT_LABELS,
  isLibraryFilterActive,
  useLibraryStore,
} from '@/stores/libraryStore';

const SORTS: LibrarySort[] = ['recent', 'title', 'author', 'progress'];
const FORMATS: FormatFilter[] = ['all', 'physical', 'ebook', 'audiobook'];

// Library filter + sort (blueprint Section 3). Writes straight to the shelf
// store, so the grid reorders live behind the sheet as the user chooses.
export default function FilterSort() {
  const t = useTheme();
  const router = useRouter();

  const sort = useLibraryStore((s) => s.sort);
  const formatFilter = useLibraryStore((s) => s.formatFilter);
  const favoritesOnly = useLibraryStore((s) => s.favoritesOnly);
  const setSort = useLibraryStore((s) => s.setSort);
  const setFormatFilter = useLibraryStore((s) => s.setFormatFilter);
  const setFavoritesOnly = useLibraryStore((s) => s.setFavoritesOnly);
  const reset = useLibraryStore((s) => s.reset);
  const active = useLibraryStore(isLibraryFilterActive);

  return (
    <SheetScaffold title="Filter & sort" onClose={() => router.back()}>
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: t.textSec }]}>SORT BY</Text>
        <View>
          {SORTS.map((key) => {
            const selected = key === sort;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSort(key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.sortRow, { borderTopColor: t.border }]}
              >
                <Text style={[styles.sortText, { color: selected ? t.text : t.textSec }]}>{SORT_LABELS[key]}</Text>
                {selected ? <Ionicons name="checkmark" size={20} color={t.accent} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: t.textSec, marginTop: 8 }]}>FORMAT</Text>
        <View style={styles.chips}>
          {FORMATS.map((key) => {
            const selected = key === formatFilter;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFormatFilter(key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accentMuted : 'transparent' },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? t.accent : t.textSec }]}>{FORMAT_LABELS[key]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setFavoritesOnly(!favoritesOnly);
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: favoritesOnly }}
          style={[styles.favRow, { borderColor: t.border }]}
        >
          <View style={styles.favLeft}>
            <Ionicons name="heart" size={18} color={favoritesOnly ? t.danger : t.textSec} />
            <Text style={[styles.favText, { color: t.text }]}>Favorites only</Text>
          </View>
          <View style={[styles.switch, { backgroundColor: favoritesOnly ? t.accent : t.bgTer }]}>
            <View style={[styles.knob, { backgroundColor: t.text, alignSelf: favoritesOnly ? 'flex-end' : 'flex-start' }]} />
          </View>
        </Pressable>

        <View style={styles.footer}>
          {active ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                reset();
              }}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
              style={[styles.resetBtn, { borderColor: t.border }]}
            >
              <Text style={[styles.resetText, { color: t.text }]}>Reset</Text>
            </Pressable>
          ) : null}
          <View style={styles.doneBtn}>
            <PrimaryButton label="Show results" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 4 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sortText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  favLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  switch: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 14 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  resetBtn: { height: 52, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  doneBtn: { flex: 1 },
});
