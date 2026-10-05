import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/shared/AppIcon';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { TOTAL_STEPS, useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';
import { KeyboardLift } from '@/components/shared/KeyboardLift';

const NAME_RE = /^[A-Za-z0-9 _'-]{2,24}$/;

// Step 5 of 6 — IDENTITY ONLY: who's reading, and (optionally) their face.
//
// This screen used to also collect email, password, Google sign-in AND the theme
// while creating the account — six decisions on the one screen with the highest
// abandon rate in the funnel. Auth moved to its own final step; theme moved out
// entirely (Settings already has the same control, and it's the most deferrable
// choice here). Nothing is written to the server yet: the whole funnel flushes
// in one transaction once an account exists.
export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const { username, setUsername, avatar, setAvatar } = useOnboardingStore();

  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo access is needed to choose a picture. You can add one later in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setError(null);
      setAvatar({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
    }
  };

  const trimmed = username.trim();
  const nameValid = NAME_RE.test(trimmed);
  const showError = touched && trimmed.length > 0 && !nameValid;

  const handleContinue = () => {
    setTouched(true);
    if (!nameValid) return;
    router.push('/(onboarding)/account' as Href);
  };

  return (
    <KeyboardLift style={styles.flex}>
      <OnboardingScaffold
        step={4}
        totalSteps={TOTAL_STEPS}
        title="Who's reading?"
        subtitle="Your name is how Quire greets you. A photo is optional — both can change later in Settings."
        scroll
        footer={<PrimaryButton label="Continue" onPress={handleContinue} disabled={!nameValid} />}
      >
        <View style={styles.body}>
          {/* Profile photo (optional) */}
          <Pressable
            onPress={pickAvatar}
            accessibilityRole="button"
            accessibilityLabel={avatar ? 'Change profile photo' : 'Add a profile photo'}
            style={styles.avatarWrap}
          >
            <View style={styles.avatarBox}>
              <View style={[styles.avatar, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <AppIcon name="person" tint="accent" size={42} />
                )}
              </View>
              <View style={[styles.avatarBadge, { backgroundColor: t.accent, borderColor: t.border }]}>
                <Ionicons name="camera" size={15} color={t.onAccent} />
              </View>
            </View>
            <Text style={[styles.avatarHint, { color: t.textSec }]}>
              {avatar ? 'CHANGE PHOTO' : 'ADD A PHOTO (OPTIONAL)'}
            </Text>
          </Pressable>

          {/* Name field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSec }]}>YOUR NAME</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Alex"
              placeholderTextColor={t.textTer}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={24}
              accessibilityLabel="Your name"
              style={[
                styles.input,
                {
                  backgroundColor: t.bgSec,
                  color: t.text,
                  borderColor: showError ? t.danger : t.border,
                },
              ]}
            />
            {showError ? (
              <Text style={[styles.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
                Use 2–24 letters, numbers, spaces or _ - '
              </Text>
            ) : (
              <Text style={[styles.helper, { color: t.textTer }]}>
                This is how Quire will greet you.
              </Text>
            )}
          </View>

          {error ? (
            <Text style={[styles.helper, { color: t.danger }]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
      </OnboardingScaffold>
    </KeyboardLift>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 20, gap: 28 },
  avatarWrap: { alignItems: 'center', alignSelf: 'center', gap: 8 },
  avatarBox: { width: 96, height: 96 },
  avatar: {
    width: 96, height: 96, borderRadius: 14, borderWidth: BORDER_WIDTH,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBadge: {
    position: 'absolute', bottom: -6, right: -6, width: 32, height: 32, borderRadius: 14,
    borderWidth: BORDER_WIDTH, alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 1 },
  field: { gap: 10 },
  label: { fontFamily: FONTS.uiBold, fontSize: 11, letterSpacing: 1.2 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: FONTS.uiMedium,
    fontSize: 17,
  },
  helper: { fontFamily: FONTS.uiRegular, fontSize: 13 },
});
