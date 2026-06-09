import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

interface ConfettiProps {
  fire: boolean;
  particleCount?: number;
  colors?: string[];
}

type Origin = 'left' | 'right' | 'center';

// Particle burst for personal-best / milestone moments (blueprint #22). Three
// emitters: a left cannon and a right cannon firing up-and-inward, plus a centre
// pop. Each particle animates on the UI thread (translate/opacity/rotate only).
// Fully suppressed under reduced motion; non-interactive + a11y-hidden.
export function Confetti({ fire, particleCount = 80, colors }: ConfettiProps) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const palette = colors ?? [t.accent, t.gold, '#FFFFFF', '#FF8A1E', '#E5327A'];

  const particles = useMemo(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: particleCount }).map((_, i) => {
      const m = i % 5;
      const origin: Origin = m < 2 ? 'left' : m < 4 ? 'right' : 'center';
      let startX: number;
      let startY: number;
      let vx: number;
      let vy: number;
      if (origin === 'left') {
        startX = -10;
        startY = rand(height * 0.55, height * 0.82);
        vx = rand(width * 0.45, width * 0.98);
        vy = -rand(height * 0.3, height * 0.62);
      } else if (origin === 'right') {
        startX = width + 10;
        startY = rand(height * 0.55, height * 0.82);
        vx = -rand(width * 0.45, width * 0.98);
        vy = -rand(height * 0.3, height * 0.62);
      } else {
        startX = width / 2;
        startY = height * 0.4;
        const ang = rand(0, Math.PI * 2);
        const dist = rand(120, 320);
        vx = Math.cos(ang) * dist;
        vy = Math.sin(ang) * dist;
      }
      return {
        id: i,
        startX,
        startY,
        vx,
        vy,
        size: rand(6, 15),
        color: palette[i % palette.length],
        delay: rand(0, 220),
        spin: rand(-720, 720),
        gravity: rand(height * 0.5, height * 0.9),
      };
    });
    // palette intentionally stable per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount, width, height]);

  if (reduceMotion) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {particles.map((p) => (
        <Particle key={p.id} {...p} fire={fire} />
      ))}
    </View>
  );
}

interface ParticleProps {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  delay: number;
  spin: number;
  gravity: number;
  fire: boolean;
}

function Particle({ startX, startY, vx, vy, size, color, delay, spin, gravity, fire }: ParticleProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (fire) {
      progress.value = 0;
      progress.value = withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
    }
  }, [fire, progress, delay]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const grav = gravity * p * p;
    return {
      opacity: p === 0 ? 0 : p < 0.8 ? 1 : (1 - p) / 0.2,
      transform: [
        { translateX: vx * p },
        { translateY: vy * p + grav },
        { rotate: `${spin * p}deg` },
        { scale: 1 - p * 0.25 },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.particle, { width: size, height: size, backgroundColor: color, left: startX, top: startY }, style]}
    />
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', borderRadius: 0 },
});
