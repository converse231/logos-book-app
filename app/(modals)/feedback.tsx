import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { FeedbackKind } from '@/services/types';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const KINDS: { key: FeedbackKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bug', label: 'Bug', icon: 'bug-outline' },
  { key: 'idea', label: 'Idea', icon: 'bulb-outline' },
  { key: 'feedback', label: 'Feedback', icon: 'chatbubble-ellipses-outline' },
];

const PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: 'What went wrong, and what were you doing when it happened?',
  idea: 'What would make Quire better for you?',
  feedback: 'Tell us what you think — the good and the rough edges.',
};

// Tester feedback / bug report (test-phase). Writes to public.feedback via
// submitFeedback, tagged with the app version + device. A bottom sheet so the
// keyboard lifts the input; a success state confirms before closing.
export default function Feedback() {
  const t = useTheme();
  const router = useRouter();
  const api = useApi();
  const params = useLocalSearchParams<{ kind?: string }>();
  const initial: FeedbackKind = (['bug', 'idea', 'feedback'] as const).includes(params.kind as FeedbackKind)
    ? (params.kind as FeedbackKind)
    : 'feedback';

  const [kind, setKind] = useState<FeedbackKind>(initial);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => router.back();

  const submit = async () => {
    const msg = message.trim();
    if (!msg || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      await api.submitFeedback({ kind, message: msg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      setSending(false);
      Alert.alert('Could not send', e?.message ?? 'Please try again.');
    }
  };

  if (sent) {
    return (
      <SheetScaffold title="Thank you" onClose={close}>
        <View style={styles.sentWrap}>
          <View style={[styles.sentIcon, { backgroundColor: t.accentMuted, borderColor: t.border }]}>
            <Ionicons name="checkmark" size={34} color={t.accent} />
          </View>
          <Text style={[styles.sentTitle, { color: t.text }]}>Feedback sent</Text>
          <Text style={[styles.sentBody, { color: t.textSec }]}>
            Thanks for helping shape Quire — every note gets read.
          </Text>
          <PrimaryButton label="Done" onPress={close} />
        </View>
      </SheetScaffold>
    );
  }

  return (
    <SheetScaffold title="Send feedback" onClose={close} scroll>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          <View style={styles.seg}>
            {KINDS.map((k) => {
              const active = kind === k.key;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => { Haptics.selectionAsync(); setKind(k.key); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={k.label}
                  style={[styles.segItem, { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentMuted : 'transparent' }]}
                >
                  <Ionicons name={k.icon} size={18} color={active ? t.accent : t.textSec} />
                  <Text style={[styles.segLabel, { color: active ? t.accent : t.textSec }]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={PLACEHOLDER[kind]}
            placeholderTextColor={t.textTer}
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bgTer }]}
            multiline
            maxLength={2000}
            accessibilityLabel="Your feedback"
          />
          <Text style={[styles.count, { color: t.textTer }]}>{message.length}/2000</Text>

          <PrimaryButton
            label={sending ? 'Sending…' : 'Send'}
            onPress={submit}
            loading={sending}
            disabled={message.trim().length === 0}
          />
          <Text style={[styles.note, { color: t.textTer }]}>
            Sent with your app version + device so we can reproduce bugs.
          </Text>
        </View>
      </ScrollView>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 8 },
  seg: { flexDirection: 'row', gap: 8 },
  segItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  segLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  input: {
    minHeight: 128, borderRadius: 14, borderWidth: 1, padding: 14,
    fontFamily: FONTS.uiMedium, fontSize: 15, lineHeight: 21, textAlignVertical: 'top',
  },
  count: { fontFamily: FONTS.mono, fontSize: 11, alignSelf: 'flex-end', marginTop: -6 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, textAlign: 'center', lineHeight: 17 },

  sentWrap: { alignItems: 'center', gap: 12, paddingVertical: 12, paddingBottom: 20 },
  sentIcon: { width: 72, height: 72, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: FONTS.displayBold, fontSize: 22 },
  sentBody: { fontFamily: FONTS.uiRegular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300, marginBottom: 4 },
});
