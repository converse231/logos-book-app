import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { FONTS } from '@/theme/tokens';
import { LevelName } from '@/services/types';
import { Card } from '@/components/shared/Card';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { LevelNameBadge } from '@/components/shared/LevelNameBadge';

interface XpLevelCardProps {
  levelName: LevelName | string;
  level: number;
  totalXp: number;
  prevLevelXp: number;
  xpToNextLevel: number; // absolute total XP at which the next level unlocks
}

// Identity + XP progress (blueprint #5). The level name is read-only identity;
// the bar shows progress within the current level toward the next.
export function XpLevelCard({ levelName, level, totalXp, prevLevelXp, xpToNextLevel }: XpLevelCardProps) {
  const t = useTheme();
  const span = Math.max(1, xpToNextLevel - prevLevelXp);
  const into = Math.max(0, totalXp - prevLevelXp);
  const remaining = Math.max(0, xpToNextLevel - totalXp);

  return (
    <Card glow padded style={styles.card}>
      <View style={styles.head}>
        <LevelNameBadge levelName={levelName} context="home" />
        <Text style={[styles.level, { color: t.textSec }]}>Level {level}</Text>
      </View>

      <Text style={[styles.xp, { color: t.text }]}>
        {totalXp.toLocaleString()}
        <Text style={[styles.xpUnit, { color: t.textSec }]}> XP</Text>
      </Text>

      <ProgressBar value={into} max={span} height={8} accent={t.gold} />
      <Text style={[styles.caption, { color: t.textSec }]}>
        {remaining.toLocaleString()} XP to Level {level + 1}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: { fontFamily: FONTS.uiSemiBold, fontSize: 13 },
  xp: { fontFamily: FONTS.uiBold, fontSize: 34, fontVariant: ['tabular-nums'] },
  xpUnit: { fontFamily: FONTS.uiSemiBold, fontSize: 18 },
  caption: { fontFamily: FONTS.uiMedium, fontSize: 13 },
});
