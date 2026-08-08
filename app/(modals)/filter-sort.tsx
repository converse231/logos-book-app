import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { PressChip } from '@/components/shared/PressChip';
import { PressRow } from '@/components/shared/PressRow';
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
              // A tinted squeeze rather than a sliding thumb: these are rows in a
              // list, and they get the same feedback every other list row in the
              // app gets.
              <PressRow
                key={key}
                onPress={() => setSort(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={SORT_LABELS[key]}
                tint={['transparent', t.bgTer]}
                style={[styles.sortRow, { borderTopColor: t.border }]}
              >
                <Text style={[styles.sortText, { color: selected ? t.text : t.textSec }]}>{SORT_LABELS[key]}</Text>
                {selected ? <Ionicons name="checkmark" size={20} color={t.accent} /> : null}
              </PressRow>
            );
          })}
        </View>

        <Text style={[styles.label, { color: t.textSec, marginTop: 8 }]}>FORMAT</Text>
        <View style={styles.chips}>
          {FORMATS.map((key) => {
            const selected = key === formatFilter;
            return (
              <PressChip
                key={key}
                selected={selected}
                onPress={() => setFormatFilter(key)}
                accessibilityLabel={FORMAT_LABELS[key]}
                style={[
                  styles.chip,
                  { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accentMuted : 'transparent' },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? t.accent : t.textSec }]}>{FORMAT_LABELS[key]}</Text>
              </PressChip>
            );
          })}
        </View>

        {/* The knob stays a hard jump — a switch reads as instant state, and the
            row's own tint already confirms the tap. */}
        <PressRow
          onPress={() => setFavoritesOnly(!favoritesOnly)}
          accessibilityRole="switch"
          accessibilityLabel="Favorites only"
          accessibilityState={{ checked: favoritesOnly }}
          tint={['transparent', t.bgTer]}
          containerStyle={styles.favWrap}
          style={[styles.favRow, { borderColor: t.border }]}
        >
          <View style={styles.favLeft}>
            <Ionicons name="heart" size={18} color={favoritesOnly ? t.danger : t.textSec} />
            <Text style={[styles.favText, { color: t.text }]}>Favorites only</Text>
          </View>
          <View style={[styles.switch, { backgroundColor: favoritesOnly ? t.accent : t.bgTer }]}>
            <View style={[styles.knob, { backgroundColor: t.text, alignSelf: favoritesOnly ? 'flex-end' : 'flex-start' }]} />
          </View>
        </PressRow>

        <View style={styles.footer}>
          {active ? (
            <PressRow
              onPress={reset}
              accessibilityLabel="Reset filters"
              tint={['transparent', t.bgTer]}
              containerStyle={styles.roundedWrap}
              style={[styles.resetBtn, { borderColor: t.border }]}
            >
              <Text style={[styles.resetText, { color: t.text }]}>Reset</Text>
            </PressRow>
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
  },
  // The pressed fill lives on the wrapper, so the wrapper is what has to be round
  // — and carry the outer spacing, or the tint would bleed into the margin.
  roundedWrap: { borderRadius: 14, overflow: 'hidden' },
  favWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  favLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favText: { fontFamily: FONTS.uiMedium, fontSize: 15 },
  switch: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 14 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  resetBtn: { height: 52, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  doneBtn: { flex: 1 },
});
