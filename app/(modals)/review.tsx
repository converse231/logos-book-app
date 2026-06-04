import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { useApi } from '@/services/ApiContext';
import { SheetScaffold } from '@/components/shared/SheetScaffold';
import { StarRating } from '@/components/library/StarRating';
import { PrimaryButton } from '@/components/onboarding/PrimaryButton';

const MAX = 1000;

// Write / edit a review (blueprint Section 3). Minors are kept off the public
// feed — the server enforces it (RLS + trigger); here we only surface the state.
export default function Review() {
  const { bookId, title } = useLocalSearchParams<{ bookId: string; title?: string }>();
  const t = useTheme();
  const router = useRouter();
  const api = useApi();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isMinor, setIsMinor] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getProfile().then((p) => alive && setIsMinor(p.isMinor));
    return () => {
      alive = false;
    };
  }, [api]);

  const close = () => router.back();

  const post = async () => {
    if (rating < 0.5 || posting || !bookId) return;
    setPosting(true);
    try {
      await api.writeReview(bookId, rating, body.trim() || undefined, spoiler);
      close();
    } catch {
      setPosting(false);
    }
  };

  return (
    <SheetScaffold title="Write a review" onClose={close}>
      <View style={styles.wrap}>
        {title ? (
          <Text style={[styles.book, { color: t.textSec }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}

          <View style={styles.ratingBlock}>
            <StarRating value={rating} onChange={setRating} allowHalf size={40} />
            <Text style={[styles.ratingHint, { color: rating > 0 ? t.text : t.textTer }]}>
              {rating > 0 ? `${formatStars(rating)} of 5 · ${RATING_WORDS[Math.ceil(rating)]}` : 'Tap to rate'}
            </Text>
          </View>

          <View style={[styles.inputWrap, { backgroundColor: t.bgTer, borderColor: t.border }]}>
            <TextInput
              value={body}
              onChangeText={(v) => v.length <= MAX && setBody(v)}
              placeholder="Share your thoughts (optional)"
              placeholderTextColor={t.textTer}
              style={[styles.input, { color: t.text }]}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Review text"
            />
          </View>
          <Text style={[styles.counter, { color: t.textTer }]}>
            {body.length}/{MAX}
          </Text>

          <Pressable
            onPress={() => setSpoiler((s) => !s)}
            accessibilityRole="switch"
            accessibilityState={{ checked: spoiler }}
            accessibilityLabel="Contains spoilers"
            style={styles.toggleRow}
          >
            <Ionicons
              name={spoiler ? 'checkbox' : 'square-outline'}
              size={22}
              color={spoiler ? t.accent : t.textSec}
            />
            <Text style={[styles.toggleText, { color: t.text }]}>This review contains spoilers</Text>
          </Pressable>

          {isMinor ? (
            <View style={[styles.notice, { backgroundColor: t.bgTer }]}>
              <Ionicons name="lock-closed" size={15} color={t.textSec} />
              <Text style={[styles.noticeText, { color: t.textSec }]}>
                Your reviews stay private to you while your account is under 18.
              </Text>
            </View>
          ) : null}

          <PrimaryButton label="Post review" onPress={post} loading={posting} disabled={rating < 0.5} />
        </View>
    </SheetScaffold>
  );
}

const RATING_WORDS: Record<number, string> = {
  1: 'Not for me',
  2: 'It was okay',
  3: 'Liked it',
  4: 'Really liked it',
  5: 'It was amazing',
};

const formatStars = (r: number) => (Number.isInteger(r) ? `${r}` : r.toFixed(1));

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 4 },
  book: { fontFamily: FONTS.uiSemiBold, fontSize: 14 },
  ratingBlock: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  ratingHint: { fontFamily: FONTS.uiSemiBold, fontSize: 15 },
  inputWrap: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 104 },
  input: { fontFamily: FONTS.uiRegular, fontSize: 15, lineHeight: 21, minHeight: 76, padding: 0 },
  counter: { fontFamily: FONTS.uiRegular, fontSize: 11, textAlign: 'right', marginTop: -8, fontVariant: ['tabular-nums'] },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleText: { fontFamily: FONTS.uiMedium, fontSize: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontFamily: FONTS.uiRegular, fontSize: 13, lineHeight: 18 },
});
