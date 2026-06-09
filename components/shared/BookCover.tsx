import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, BORDER_WIDTH } from '@/theme/tokens';
import { BookFormat } from '@/services/types';

interface BookCoverProps {
  url?: string | null;
  title: string;
  format?: BookFormat;
  showFormatBadge?: boolean;
  width: number;
  aspectRatio?: number;
}

// Cover with graceful fallback (blueprint #7). expo-image with memory-disk
// cache; on missing/failed URL shows a spine-glyph placeholder + title so the
// shelf never renders an empty box.
export function BookCover({
  url,
  title,
  format = 'physical',
  showFormatBadge = false,
  width,
  aspectRatio = 0.66,
}: BookCoverProps) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const height = width / aspectRatio;
  const showPlaceholder = !url || failed;

  return (
    <View
      style={[
        styles.wrap,
        { width, height, backgroundColor: t.bgTer, borderColor: t.border },
      ]}
    >
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          <Ionicons name="book" size={width * 0.3} color={t.textTer} />
          <Text style={[styles.placeholderTitle, { color: t.textSec }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: url! }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          onError={() => setFailed(true)}
          accessibilityLabel={`Cover of ${title}`}
        />
      )}

      {showFormatBadge && format !== 'physical' ? (
        <View style={[styles.badge, { backgroundColor: t.overlay }]}>
          <Text style={styles.badgeText}>{format === 'ebook' ? 'E-Book' : 'Audio'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 0, borderWidth: BORDER_WIDTH },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 },
  placeholderTitle: { fontFamily: FONTS.uiSemiBold, fontSize: 11, textAlign: 'center' },
  badge: {
    position: 'absolute', bottom: 0, left: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0,
  },
  badgeText: { fontFamily: FONTS.monoBold, fontSize: 9, color: '#FFFFFF', letterSpacing: 0.4, textTransform: 'uppercase' },
});
