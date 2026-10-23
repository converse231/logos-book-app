import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS } from '@/theme/tokens';

interface AppleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** CONTINUE in the signup funnel, SIGN_IN on the returning-reader screen. */
  type?: 'continue' | 'signIn';
}

// A free-Apple-ID build (app.config.js, QUIRE_FREE_SIGNING) has no Sign in with
// Apple entitlement: the sheet would open and then fail. Hide it there.
const isFreeSigned = Constants.expoConfig?.extra?.freeSigning === true;

/** True on an iOS device that can show the Apple sheet; false everywhere else
 *  (Android, web, free-signed builds), so callers render nothing rather than a
 *  dead button. */
export function useAppleAuthAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || isFreeSigned) return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch((e) => {
        console.warn('[AppleButton] availability check failed', e);
        setAvailable(false);
      });
  }, []);
  return available;
}

// Apple's own control, NOT a Paper & Ink block: Human Interface Guidelines fix
// its fill, glyph and wording, and App Review rejects a restyled one. Only the
// size and corner radius are ours — matched to GoogleButton so the two stack
// as a pair. Black on light paper, white on the dark theme.
export function AppleButton({ onPress, loading, disabled, type = 'continue' }: AppleButtonProps) {
  const t = useTheme();
  const inactive = !!(disabled || loading);
  return (
    <View
      style={[styles.wrap, inactive && styles.dim]}
      pointerEvents={inactive ? 'none' : 'auto'}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          type === 'signIn'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
        }
        buttonStyle={
          t.mode === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={RADIUS.md}
        onPress={onPress}
        style={styles.btn}
      />
      {loading ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={t.mode === 'dark' ? '#000' : '#fff'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 54 },
  // The native view needs an explicit size or it renders nothing.
  btn: { width: '100%', height: 54 },
  dim: { opacity: 0.6 },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 18,
  },
});
