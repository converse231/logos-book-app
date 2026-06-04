import { useCallback } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';

const ITEM_HEIGHT = 48;
const VISIBLE = 5; // odd → a true centre row
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE;
const TOP_PAD = (PICKER_HEIGHT - ITEM_HEIGHT) / 2; // padding so first/last items can centre

interface WheelPickerProps {
  values: number[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

// Vertical snapping wheel. Scroll + item scale/opacity run on the UI thread
// (Reanimated scroll handler) so it stays smooth on low-end Android. Snaps to
// ITEM_HEIGHT; fires a selection haptic + onChange on settle. The centre
// highlight band is an overlay centred in the track so it always frames the
// selected row exactly.
export function WheelPicker({ values, selectedIndex, onChange }: WheelPickerProps) {
  const t = useTheme();
  const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      if (clamped !== selectedIndex) {
        Haptics.selectionAsync();
        onChange(clamped);
      }
    },
    [onChange, selectedIndex, values.length]
  );

  return (
    <View style={styles.wrap}>
      {/* centre highlight band — sits behind the numbers, vertically centred */}
      <View pointerEvents="none" style={styles.bandOverlay}>
        <View style={[styles.band, { borderColor: t.border, backgroundColor: t.bgSec }]} />
      </View>

      <Animated.FlatList
        data={values}
        keyExtractor={(v) => String(v)}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: TOP_PAD + ITEM_HEIGHT * index,
          index,
        })}
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: TOP_PAD }}
        renderItem={({ index }) => (
          <WheelItem index={index} value={values[index]} scrollY={scrollY} color={t.text} />
        )}
      />
    </View>
  );
}

function WheelItem({
  index,
  value,
  scrollY,
  color,
}: {
  index: number;
  value: number;
  scrollY: SharedValue<number>;
  color: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.value / ITEM_HEIGHT - index);
    return {
      opacity: interpolate(distance, [0, 1, 2.5], [1, 0.45, 0.12], 'clamp'),
      transform: [{ scale: interpolate(distance, [0, 1, 2.5], [1, 0.82, 0.66], 'clamp') }],
    };
  });
  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <Text style={[styles.itemText, { color }]}>{value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: PICKER_HEIGHT, justifyContent: 'center' },
  bandOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  band: {
    height: ITEM_HEIGHT,
    marginHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: FONTS.uiSemiBold, fontSize: 26, fontVariant: ['tabular-nums'] },
});
