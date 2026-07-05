import { StyleSheet, View } from 'react-native';
import { LoadingIndicator } from './LoadingIndicator';

// Pull-to-refresh built around the app's bouncing-ball LoadingIndicator instead
// of the platform spinner. The native RefreshControl still drives the gesture +
// threshold, but its own spinner is made invisible via HIDDEN_SPINNER (spread
// onto the <RefreshControl>); RefreshingOverlay then paints our indicator, pinned
// near the top, for the duration of the refresh.
export const HIDDEN_SPINNER: { tintColor: string; colors: string[]; progressBackgroundColor: string } = {
  tintColor: 'transparent',           // iOS
  colors: ['transparent'],            // Android arrow
  progressBackgroundColor: 'transparent', // Android circle
};

export function RefreshingOverlay({ refreshing, top }: { refreshing: boolean; top: number }) {
  if (!refreshing) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top }]}>
      <LoadingIndicator size={42} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
});
