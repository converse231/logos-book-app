import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { ReadingGoal } from '@/services/types';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { Stepper } from '@/components/onboarding/Stepper';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { useReadingProjection } from '@/hooks/useReadingProjection';

const PRESETS = [6, 12, 24, 52];

// Edit reading goal — writes: reading_goals. Reuses the Stepper and
// useReadingProjection from onboarding for a coherent experience.
export default function GoalEdit() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const year = new Date().getFullYear();

  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [books, setBooks] = useState(12);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getGoal(year).then((g) => {
      if (!alive) return;
      if (g) {
        setGoal(g);
        setBooks(g.goalBooks);
      }
    });
    return () => { alive = false; };
  }, [api, year]);

  const proj = useReadingProjection(books);

  const save = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      await api.updateGoal(year, books);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const close = () => router.back();

  return (
    <SheetScaffold title={`${year} Reading Goal`} onClose={close} scroll>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          <View style={styles.stepperWrap}>
            <Stepper value={books} onChange={setBooks} min={1} max={365} unit="books" />
          </View>

          {/* Quick presets */}
          <View style={styles.presetsWrap}>
            <Text style={[styles.presetsLabel, { color: t.textSec }]}>Quick pick</Text>
            <View style={styles.presets}>
              {PRESETS.map((p) => {
                const active = books === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => { Haptics.selectionAsync(); setBooks(p); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.preset,
                      { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.presetValue, { color: active ? t.accent : t.text }]}>{p}</Text>
                    <Text style={[styles.presetLabel, { color: active ? t.accent : t.textSec }]}>
                      {p === 52 ? 'one/wk' : p === 24 ? 'two/mo' : p === 12 ? 'one/mo' : 'every 2m'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Projection */}
          <View style={[styles.projCard, { backgroundColor: t.bgTer, borderColor: t.border }]}>
            <Text style={[styles.projTitle, { color: t.text }]}>What that means</Text>
            <View style={styles.projRows}>
              <ProjRow icon="time-outline" label="Daily reading" value={`~${proj.minPerDay} min/day`} t={t} />
              <ProjRow icon="calendar-outline" label="Days remaining" value={`${proj.daysRemaining} days`} t={t} />
              <ProjRow icon="book-outline" label="Pace" value={proj.booksPerDay < 1 ? `1 book every ${Math.round(1 / proj.booksPerDay)} days` : `${proj.booksPerDay.toFixed(1)}/day`} t={t} />
            </View>
            {proj.isDecemberCrunch ? (
              <View style={[styles.crunch, { backgroundColor: 'rgba(255,197,61,0.12)' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={t.gold} />
                <Text style={[styles.crunchText, { color: t.gold }]}>That's ambitious this late in the year — but doable.</Text>
              </View>
            ) : proj.isEstimate ? (
              <Text style={[styles.estimate, { color: t.textTer }]}>Based on 60 pages/hr until you have real data.</Text>
            ) : null}
          </View>

          {goal ? (
            <Text style={[styles.prev, { color: t.textTer }]}>
              Current goal: {goal.goalBooks} books
            </Text>
          ) : null}

          <PrimaryButton label={saving ? 'Saving…' : 'Save goal'} onPress={save} loading={saving} />
        </View>
      </ScrollView>
    </SheetScaffold>
  );
}

function ProjRow({ icon, label, value, t }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.projRow}>
      <Ionicons name={icon} size={16} color={t.accent} />
      <Text style={[styles.projLabel, { color: t.textSec }]}>{label}</Text>
      <Text style={[styles.projValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20, paddingBottom: 8 },
  stepperWrap: { alignItems: 'center', paddingVertical: 8 },
  presetsWrap: { gap: 10 },
  presetsLabel: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1 },
  presets: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 2 },
  presetValue: { fontFamily: FONTS.uiBold, fontSize: 22, fontVariant: ['tabular-nums'] },
  presetLabel: { fontFamily: FONTS.uiMedium, fontSize: 11 },
  projCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  projTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  projRows: { gap: 10 },
  projRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projLabel: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 13 },
  projValue: { fontFamily: FONTS.uiSemiBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  crunch: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14 },
  crunchText: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 12, lineHeight: 17 },
  estimate: { fontFamily: FONTS.uiRegular, fontSize: 12 },
  prev: { fontFamily: FONTS.uiRegular, fontSize: 13, textAlign: 'center', marginTop: -6 },
});
