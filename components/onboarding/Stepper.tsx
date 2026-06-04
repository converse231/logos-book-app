import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const SWIPE_STEP_PX = 18; // horizontal drag distance per ±1

// Large numeric stepper with three input methods:
//   1. ± buttons (tap)
//   2. Horizontal swipe on the number (drag right = up, left = down)
//   3. Tap the number → inline TextInput for direct keyboard entry
// Validates + clamps on blur and Return; bad values silently revert to the last
// good one. Exposes an `adjustable` a11y role for screen readers.
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  unit,
}: StepperProps) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const valueRef = useRef(value);
  valueRef.current = value;

  const applyValue = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    if (clamped !== valueRef.current) {
      valueRef.current = clamped;
      Haptics.selectionAsync();
      onChange(clamped);
    }
  };
  const bump = (dir: number) => applyValue(valueRef.current + dir * step);

  // --- swipe gesture ---
  const acc = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!editing)
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin(() => { acc.value = 0; })
    .onChange((e) => {
      acc.value += e.changeX;
      while (acc.value >= SWIPE_STEP_PX) {
        acc.value -= SWIPE_STEP_PX;
        runOnJS(bump)(1);
      }
      while (acc.value <= -SWIPE_STEP_PX) {
        acc.value += SWIPE_STEP_PX;
        runOnJS(bump)(-1);
      }
    })
    .onFinalize(() => { acc.value = 0; });

  // --- inline edit ---
  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
    // TextInput autoFocus handles the actual focus
  };

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) applyValue(parsed);
    setEditing(false);
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.row}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: `${value}${unit ? ' ' + unit : ''}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') bump(1);
          if (e.nativeEvent.actionName === 'decrement') bump(-1);
        }}
      >
        <StepButton
          icon="remove"
          onPress={() => bump(-1)}
          disabled={value <= min || editing}
          bg={t.bgSec}
          border={t.border}
          color={t.text}
          label="Decrease goal"
        />

        <GestureDetector gesture={pan}>
          <Pressable
            onPress={startEditing}
            accessibilityLabel={`Current value ${value}. Tap to type a number.`}
            style={styles.valueWrap}
          >
            {editing ? (
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                onBlur={commitDraft}
                onSubmitEditing={commitDraft}
                keyboardType="number-pad"
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
                maxLength={3}
                style={[styles.valueInput, { color: t.accent, borderBottomColor: t.accent }]}
                accessibilityLabel="Type number of books"
              />
            ) : (
              <Text style={[styles.value, { color: t.text }]}>{value}</Text>
            )}
            {unit ? <Text style={[styles.unit, { color: t.textSec }]}>{unit}</Text> : null}
          </Pressable>
        </GestureDetector>

        <StepButton
          icon="add"
          onPress={() => bump(1)}
          disabled={value >= max || editing}
          bg={t.bgSec}
          border={t.border}
          color={t.text}
          label="Increase goal"
        />
      </View>

      {/* contextual hint — swipe hint when not editing, keyboard hint when not editing */}
      <View style={styles.hintRow} pointerEvents="none">
        {editing ? (
          <Text style={[styles.hint, { color: t.accent }]}>type a number, then tap Done</Text>
        ) : (
          <>
            <Ionicons name="chevron-back" size={14} color={t.textTer} />
            <Text style={[styles.hint, { color: t.textTer }]}>swipe or tap to type</Text>
            <Ionicons name="chevron-forward" size={14} color={t.textTer} />
          </>
        )}
      </View>
    </View>
  );
}

function StepButton({
  icon, onPress, disabled, bg, border, color, label,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled: boolean;
  bg: string;
  border: string;
  color: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  btn: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  valueWrap: { alignItems: 'center', minWidth: 120, paddingVertical: 4 },
  value: {
    fontFamily: FONTS.displayBold, fontSize: 72, lineHeight: 78,
    fontVariant: ['tabular-nums'],
  },
  // TextInput in edit mode: same size as the Text so no layout jump
  valueInput: {
    fontFamily: FONTS.displayBold, fontSize: 72, lineHeight: 78,
    fontVariant: ['tabular-nums'],
    textAlign: 'center', minWidth: 120, padding: 0,
    borderBottomWidth: 2,
  },
  unit: { fontFamily: FONTS.uiMedium, fontSize: 15, marginTop: -4 },
  hintRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
  },
  hint: { fontFamily: FONTS.uiMedium, fontSize: 12, letterSpacing: 0.3 },
});
