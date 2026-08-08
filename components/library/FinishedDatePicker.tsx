import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, INK, PALETTE, BORDER_WIDTH, BORDER_WIDTH_THICK } from '@/theme/tokens';
import { PressBlock } from '@/components/shared/PressBlock';
import { PressChip } from '@/components/shared/PressChip';
import { PressRow } from '@/components/shared/PressRow';

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
                <PressChip
                  key={y}
                  selected={active}
                  onPress={() => setYear(y)}
                  accessibilityLabel={String(y)}
                  style={[styles.yearChip, { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : t.bgSec }]}
                >
                  <Text style={[styles.yearText, { color: active ? t.accent : t.text }]}>{y}</Text>
                </PressChip>
              );
            })}
          </View>

          <Text style={[styles.label, { color: t.textSec }]}>MONTH</Text>
          <View style={styles.monthGrid}>
            {MONTHS.map((m, i) => {
              const active = i === month;
              const disabled = isFuture(i, year);
              return (
                <PressChip
                  key={m}
                  selected={active}
                  disabled={disabled}
                  onPress={() => setMonth(i)}
                  accessibilityLabel={m}
                  // The percentage width has to sit on the wrapper — it's the grid's
                  // flex child now, and '22%' of a content-sized wrapper is nothing.
                  containerStyle={styles.monthCell}
                  style={[
                    styles.monthChip,
                    { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : t.bgSec },
                    disabled && { opacity: 0.3 },
                  ]}
                >
                  <Text style={[styles.monthText, { color: active ? t.accent : t.text }]}>{m}</Text>
                </PressChip>
              );
            })}
          </View>

          <View style={styles.actions}>
            <PressRow
              onPress={onClose}
              accessibilityLabel="Cancel"
              tint={['transparent', t.bgTer]}
              containerStyle={styles.cancelWrap}
              style={[styles.cancelBtn, { borderColor: t.border }]}
            >
              <Text style={[styles.cancelText, { color: t.text }]}>CANCEL</Text>
            </PressRow>
            <PressBlock
              onPress={confirm}
              emphasis="primary"
              accessibilityLabel="Confirm finish date"
              containerStyle={styles.confirmWrap}
              style={[styles.confirmBtn, { backgroundColor: t.accent }]}
            >
              {/* Shrinks rather than wraps. At a large system font size this label
                  used to break onto two lines, which grew the coral face past the
                  52dp Cancel next to it — that's what made the pair look crooked. */}
              <Text style={styles.confirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                MARK FINISHED
              </Text>
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
  monthCell: { width: '22%', flexGrow: 1 },
  monthChip: { height: 42, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  // flex-start, not center: the confirm block reserves 4px below itself for its
  // hard shadow, so centering the two made the faces sit at different heights.
  // Aligned at the top with equal 52dp faces, they read as a matched pair.
  actions: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 12 },
  // flex on the wrapper (it's the row's child); the face keeps the border.
  cancelWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  cancelBtn: { height: 52, borderRadius: 14, borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 0.8 },
  confirmWrap: { flex: 1 },
  confirmBtn: {
    height: 52, borderRadius: 14, borderWidth: BORDER_WIDTH_THICK, borderColor: INK,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  // Ink on coral, not white — the house signature. This button was the one place
  // still using white, which read as a different button family.
  confirmText: { fontFamily: FONTS.uiBold, fontSize: 14, letterSpacing: 1, color: PALETTE.onAccent },
});
