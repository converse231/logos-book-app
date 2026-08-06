import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS, INK, PALETTE, RADIUS, BORDER_WIDTH_THICK, SHADOW } from '@/theme/tokens';
import { useTourTarget } from '@/components/tour/TourProvider';

// Duolingo-style illustrated streak banner. The scene + Q's pose are baked into
// one of 10 hand-drawn variants chosen from the live streak state; the count and
// label are rendered on top of the reserved calm right zone over a legibility
// scrim. Art is fixed-identity (drawn for both themes), so this doesn't read
// ThemeTokens — text colour is per-variant (ink on light scenes, cream on dark).
export type StreakVariant =
  | 'start' | 'day1' | 'building' | 'week' | 'month'
  | 'hundred' | 'legend' | 'atRisk' | 'broken' | 'night'
  | 'nudge' | 'almostThere' | 'personalBest' | 'comebackWin' | 'earlyBird'
  | 'ghost' | 'lastChance' | 'frozen' | 'perfectWeek' | 'milestoneDay';

const CREAM = '#FBF6EC';

interface VariantSpec {
  img: number;
  tone: 'light' | 'dark'; // scene brightness in the text zone → text colour
  msg: string;
}

const VARIANTS: Record<StreakVariant, VariantSpec> = {
  start:    { img: require('@/assets/streak-hero/start.webp'),    tone: 'light', msg: 'Start your streak' },
  day1:     { img: require('@/assets/streak-hero/day1.webp'),     tone: 'light', msg: 'Nice start!' },
  building: { img: require('@/assets/streak-hero/building.webp'), tone: 'light', msg: "It's catching!" },
  week:     { img: require('@/assets/streak-hero/week.webp'),     tone: 'light', msg: 'On a roll!' },
  month:    { img: require('@/assets/streak-hero/month.webp'),    tone: 'dark',  msg: 'Unstoppable!' },
  hundred:  { img: require('@/assets/streak-hero/hundred.webp'),  tone: 'dark',  msg: 'Incredible!' },
  legend:   { img: require('@/assets/streak-hero/legend.webp'),   tone: 'dark',  msg: 'Legendary!' },
  atRisk:   { img: require('@/assets/streak-hero/atRisk.webp'),   tone: 'dark',  msg: 'Save your streak!' },
  broken:   { img: require('@/assets/streak-hero/broken.webp'),   tone: 'dark',  msg: 'Comeback time' },
  night:    { img: require('@/assets/streak-hero/night.webp'),    tone: 'dark',  msg: "You're set for today" },
  nudge:        { img: require('@/assets/streak-hero/nudge.webp'),        tone: 'light', msg: 'Keep it going!' },
  almostThere:  { img: require('@/assets/streak-hero/almostThere.webp'),  tone: 'light', msg: 'So close!' },
  personalBest: { img: require('@/assets/streak-hero/personalBest.webp'), tone: 'light', msg: 'Personal best!' },
  comebackWin:  { img: require('@/assets/streak-hero/comebackWin.webp'),  tone: 'dark',  msg: 'Streak restored!' },
  earlyBird:    { img: require('@/assets/streak-hero/earlyBird.webp'),    tone: 'light', msg: 'Early bird!' },
  ghost:        { img: require('@/assets/streak-hero/ghost.webp'),        tone: 'dark',  msg: 'We miss you' },
  lastChance:   { img: require('@/assets/streak-hero/lastChance.webp'),   tone: 'dark',  msg: 'Last chance!' },
  frozen:       { img: require('@/assets/streak-hero/frozen.webp'),       tone: 'dark',  msg: 'Streak frozen' },
  perfectWeek:  { img: require('@/assets/streak-hero/perfectWeek.webp'),  tone: 'dark',  msg: 'Perfect week!' },
  milestoneDay: { img: require('@/assets/streak-hero/milestoneDay.webp'), tone: 'light', msg: 'Milestone!' },
};

// State → variant (persistent home states only). Urgent first, then lapsed/near-
// milestone, then daily nudge, then cozy time-of-day, then tier by length.
// personalBest / comebackWin / frozen / perfectWeek / milestoneDay are "moment"
// celebrations fired from their events (session-complete, comeback, freeze) — they
// live in VARIANTS but the persistent selector never auto-picks them.
export function pickStreakVariant(args: {
  currentStreak: number;
  isAtRisk: boolean;
  hasComeback: boolean;
  hasEverRead: boolean;
  almostThere: boolean;
  readToday: boolean;
  hour: number;
}): StreakVariant {
  const d = args.currentStreak;
  const night = args.hour >= 21 || args.hour < 5;
  const morning = args.hour >= 5 && args.hour < 10;

  // Urgent states win; at-risk escalates to "last chance" late at night.
  if (args.isAtRisk) return night ? 'lastChance' : 'atRisk';
  if (args.hasComeback) return 'broken';

  // Streak at 0: a lapsed reader gets the wistful ghost; a brand-new one, the start.
  if (d <= 0) return args.hasEverRead ? 'ghost' : 'start';

  // Near a milestone — anticipation over the tier art.
  if (args.almostThere) return 'almostThere';

  // Haven't read yet today (streak alive, before the 6pm at-risk flag).
  if (!args.readToday) return 'nudge';

  // Read today: cozy time-of-day scenes.
  if (night) return 'night';
  if (morning) return 'earlyBird';

  // Otherwise, tier by streak length.
  if (d <= 2) return 'day1';
  if (d <= 6) return 'building';
  if (d <= 29) return 'week';
  if (d <= 99) return 'month';
  if (d <= 364) return 'hundred';
  return 'legend';
}

interface StreakHeroProps {
  currentStreak: number;
  isAtRisk: boolean;
  hasComeback: boolean;
  hasEverRead: boolean;
  almostThere: boolean;
  readToday: boolean;
  onPress?: () => void;
}

export function StreakHero({
  currentStreak,
  isAtRisk,
  hasComeback,
  hasEverRead,
  almostThere,
  readToday,
  onPress,
}: StreakHeroProps) {
  const tour = useTourTarget('streak');
  const hour = new Date().getHours();
  const variant = pickStreakVariant({ currentStreak, isAtRisk, hasComeback, hasEverRead, almostThere, readToday, hour });
  const spec = VARIANTS[variant];
  const dark = spec.tone === 'dark';
  const textColor = dark ? CREAM : INK;

  // A count of 0 (fresh start, or a broken streak mid-comeback) reads sad — lead
  // with the message instead of a big "0".
  const showNumber = currentStreak > 0 && variant !== 'broken';

  const scrim: [string, string, string] = dark
    ? ['transparent', 'rgba(12,9,7,0.18)', 'rgba(12,9,7,0.5)']
    : ['transparent', 'rgba(255,251,242,0.3)', 'rgba(255,251,242,0.62)'];
  const shadowColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,251,242,0.7)';

  const a11y = showNumber
    ? `${currentStreak} day${currentStreak === 1 ? '' : 's'} streak. ${spec.msg}`
    : spec.msg;

  return (
    <Pressable
      ref={tour.ref}
      onLayout={tour.onLayout}
      collapsable={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={styles.card}
    >
      <Image source={spec.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      <LinearGradient
        colors={scrim}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.textCol}>
          {showNumber ? (
            <>
              <Text style={[styles.count, { color: textColor, textShadowColor: shadowColor }]}>
                {currentStreak}
              </Text>
              <Text style={[styles.label, { color: textColor, textShadowColor: shadowColor }]}>
                {currentStreak === 1 ? 'DAY' : 'DAY STREAK'}
              </Text>
              <Text style={[styles.msg, { color: textColor, textShadowColor: shadowColor }]}>{spec.msg}</Text>
            </>
          ) : (
            <Text style={[styles.msgLead, { color: textColor, textShadowColor: shadowColor }]}>{spec.msg}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1942 / 809,
    borderRadius: RADIUS.card,
    borderWidth: BORDER_WIDTH_THICK,
    borderColor: INK,
    overflow: 'hidden',
    backgroundColor: PALETTE.paper,
    ...SHADOW.card,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  textCol: { alignItems: 'flex-end', maxWidth: '60%' },
  count: {
    fontFamily: FONTS.monoBold,
    fontSize: 52,
    lineHeight: 54,
    fontVariant: ['tabular-nums'],
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
    includeFontPadding: false,
  },
  label: {
    fontFamily: FONTS.monoMedium,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 2,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  msg: {
    fontFamily: FONTS.uiBold,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'right',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  msgLead: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'right',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
});
