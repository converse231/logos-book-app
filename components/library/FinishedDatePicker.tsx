import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "When did you finish it?" — month + year picker for backfilling already-read
// books so they count in the right month/year on stats. Returns a mid-month ISO
// (day 15, noon) to stay clear of timezone month-flips. Future months are blocked.
export function FinishedDatePicker({
  visible,
  initialISO,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialISO?: string | null;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const t = useTheme();
  const now = new Date();
  const init = initialISO ? new Date(initialISO) : now;
  const [month, setMonth] = useState(init.getMonth());
  const [year, setYear] = useState(init.getFullYear());

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i); // this year + 5 back
  const isFuture = (m: number, y: number) => y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());

  const confirm = () => {
    if (isFuture(month, year)) return;
    onConfirm(new Date(year, month, 15, 12, 0, 0).toISOString());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable style={[styles.panel, { backgroundColor: t.bg, borderColor: t.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: t.text }]}>When did you finish it?</Text>

          <Text style={[styles.label, { color: t.textSec }]}>YEAR</Text>
          <View style={styles.yearRow}>
            {years.map((y) => {
              const active = y === year;
              return (
                <Pressable
                  key={y}
                  onPress={() => setYear(y)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.yearChip, { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : t.bgSec }]}
                >
                  <Text style={[styles.yearText, { color: active ? t.accent : t.text }]}>{y}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: t.textSec }]}>MONTH</Text>
          <View style={styles.monthGrid}>
            {MONTHS.map((m, i) => {
              const active = i === month;
              const disabled = isFuture(i, year);
              return (
                <Pressable
                  key={m}
                  onPress={() => !disabled && setMonth(i)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                  style={[
                    styles.monthChip,
                    { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : t.bgSec },
                    disabled && { opacity: 0.3 },
                  ]}
                >
                  <Text style={[styles.monthText, { color: active ? t.accent : t.text }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={[styles.cancelBtn, { borderColor: t.border }]}>
              <Text style={[styles.cancelText, { color: t.text }]}>CANCEL</Text>
            </Pressable>
            <PressBlock onPress={confirm} accessibilityLabel="Confirm finish date" containerStyle={styles.confirmWrap} style={[styles.confirmBtn, { backgroundColor: t.accent }]}>
              <Text style={styles.confirmText}>MARK FINISHED</Text>
            </PressBlock>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(3,4,6,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 380, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, padding: 20, gap: 10, ...({ boxShadow: '6px 6px 0px #241E19' } as const) },
  title: { fontFamily: FONTS.displayBold, fontSize: 22, letterSpacing: -0.3, marginBottom: 2 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1, marginTop: 6 },
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearChip: { paddingHorizontal: 12, height: 38, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  yearText: { fontFamily: FONTS.monoBold, fontSize: 14 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: { width: '22%', flexGrow: 1, height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
  confirmWrap: { flex: 1 },
  confirmBtn: { minHeight: 52, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: '#241E19', alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1, color: '#FFFFFF' },
});
