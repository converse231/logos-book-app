import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/shared/AppIcon';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS, PALETTE, BORDER_WIDTH, SHADOW } from '@/theme/tokens';
import { Badge } from '@/services/types';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface BadgeGridProps {
  badges: Badge[];
  onPress?: (badge: Badge) => void;
}

// Achievement medallions (blueprint Stats). Earned badges glow gold; unearned
// are muted with a progress bar toward their threshold. Icon-based (no image
// assets) so nothing can 404.
export function BadgeGrid({ badges, onPress }: BadgeGridProps) {
  return (
    <View style={styles.grid}>
      {badges.map((b) => (
        <BadgeMedallion key={b.id} badge={b} onPress={onPress} />
      ))}
    </View>
  );
}

function BadgeMedallion({ badge, onPress }: { badge: Badge; onPress?: (b: Badge) => void }) {
  const t = useTheme();
  const unlocked = !!badge.unlockedAt;
  const ratio = badge.unlockThreshold > 0 ? Math.min(1, badge.progressValue / badge.unlockThreshold) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && onPress ? styles.pressed : null]}
      onPress={onPress ? () => onPress(badge) : undefined}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={`${badge.name}. ${unlocked ? 'Unlocked.' : `${badge.progressValue} of ${badge.unlockThreshold}.`}`}
    >
      <View
        style={[
          styles.medallion,
          unlocked
            ? { backgroundColor: PALETTE.gold, borderColor: t.border }
            : { backgroundColor: t.bgTer, borderColor: t.border },
        ]}
      >
        {/* All nine badge glyphs are painted in ink, which is exactly what an
            unlocked medallion wants on its gold fill. The locked state is the SAME
            file at low opacity rather than a second muted set — ink at 0.38 over
            the cream tile lands on roughly textTer, which is what the font glyph
            used, and it halves the artwork. `color` still drives the font
            fallback for any badge whose art hasn't landed. */}
        <AppIcon
          name={badge.iconName as keyof typeof Ionicons.glyphMap}
          tint="ink"
          size={26}
          color={unlocked ? '#241E19' : t.textTer}
          style={unlocked ? undefined : { opacity: 0.38 }}
        />
        {!unlocked && ratio === 0 ? (
          <View style={[styles.lock, { backgroundColor: t.bgSec, borderColor: t.border }]}>
            <Ionicons name="lock-closed" size={11} color={t.textSec} />
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, { color: unlocked ? t.text : t.textSec }]} numberOfLines={1}>
        {badge.name}
      </Text>

      {unlocked ? (
        <Text style={[styles.status, { color: t.gold }]}>EARNED</Text>
      ) : ratio > 0 ? (
        <View style={styles.progress}>
          <ProgressBar value={ratio} max={1} height={6} accent={PALETTE.gold} animateOnMount={false} />
          <Text style={[styles.progressText, { color: t.textTer }]}>
            {badge.progressValue}/{badge.unlockThreshold}
          </Text>
        </View>
      ) : (
        <Text style={[styles.status, { color: t.textTer }]}>LOCKED</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  cell: { width: '30%', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.7 },
  medallion: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  lock: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: FONTS.uiBold, fontSize: 12, textAlign: 'center' },
  status: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 0.5 },
  progress: { width: '90%', alignItems: 'center', gap: 3 },
  progressText: { fontFamily: FONTS.mono, fontSize: 10, fontVariant: ['tabular-nums'] },
});
