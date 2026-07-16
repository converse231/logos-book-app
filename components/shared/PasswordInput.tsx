import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

type PasswordInputProps = Omit<TextInputProps, 'style'> & { containerStyle?: StyleProp<ViewStyle> };

// A password field with a reveal (eye) toggle, styled to match the app's other
// inputs (neubrutalist: bgSec fill, thin ink border, sharp corners). Accepts all
// TextInput props; manages secureTextEntry + autoCapitalize/autoCorrect itself.
export function PasswordInput({ containerStyle, accessibilityLabel = 'Password', ...rest }: PasswordInputProps) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, { backgroundColor: t.bgSec, borderColor: t.border }, containerStyle]}>
      <TextInput
        {...rest}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={t.textTer}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: t.text }]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={styles.eyeBtn}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.textSec} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
  },
  input: { flex: 1, fontFamily: FONTS.uiMedium, fontSize: 17, paddingVertical: 0 },
  eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
