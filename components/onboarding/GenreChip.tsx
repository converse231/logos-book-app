import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

interface GenreChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

// Toggle chip. Selected = accent fill; press gives a quick scale dip + selection
// haptic. State conveyed by fill + border + weight (not colour alone) and an
// accessibilityState.selected flag.
export function GenreChip({ label, selected, onToggle }: GenreChipProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    if (!reduceMotion) {
      scale.value = withTiming(0.94, { duration: 80 }, () => {
        scale.value = withTiming(1, { duration: 120 });
      });
    }
    Haptics.selectionAsync();
    onToggle();
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? t.accent : t.bgSec,
            borderColor: selected ? t.accent : t.border,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: selected ? t.onAccent : t.text, fontFamily: selected ? FONTS.uiBold : FONTS.uiMedium },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, letterSpacing: 0.5 },
});
