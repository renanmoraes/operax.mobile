import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '@/src/design-system/tokens';

/**
 * Efeitos da comemoração de conquistas: confete caindo, explosão de confete, brilhos piscando e o clarão com
 * raios atrás da carta. Todos param com "reduzir movimento" ligado no aparelho.
 *
 * Cores: as da marca (azul-marinho, azul e ciano do app), com o dourado só como destaque do prêmio.
 */

/** Dourado do prêmio, puxado para o champanhe (menos laranja): moldura da carta, louros, moeda e destaques. */
export const GOLD = { light: '#FFEBB0', main: '#F0C050', deep: '#B8872A' };
/** Azuis da marca usados na comemoração. */
export const FX = {
  navy: colors.chromeNavy,
  navySoft: colors.chromeNavySoft,
  blue: colors.primary,
  /** O azul da marca clareado, para brilhar sobre o fundo escuro. */
  sky: '#6FA0FF',
  cyan: colors.cyan,
} as const;
const COLORS = ['#FFFFFF', FX.cyan, FX.sky, GOLD.main, '#DCE8FF', GOLD.light];

/** Número "aleatório" fixo por posição (0–1): os mesmos pedaços a cada abertura, sem `Math.random` na renderização. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Piece({ i, h, w }: { i: number; h: number; w: number }) {
  const t = useSharedValue(0);
  const spin = useSharedValue(0);
  const cfg = useMemo(() => ({
    x: rnd(i, 1) * w, size: 6 + rnd(i, 2) * 7, dur: 4200 + rnd(i, 3) * 4200, delay: rnd(i, 4) * 4200,
    sway: 1 + Math.floor(rnd(i, 5) * 3), amp: 10 + rnd(i, 6) * 22, color: COLORS[i % COLORS.length], round: rnd(i, 7) > 0.8,
  }), [i, w]);
  useEffect(() => {
    t.value = withDelay(cfg.delay, withRepeat(withTiming(1, { duration: cfg.dur, easing: Easing.linear }), -1, false));
    spin.value = withRepeat(withTiming(1, { duration: 1400 + rnd(i, 8) * 1600, easing: Easing.linear }), -1, false);
  }, [cfg, i, t, spin]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1,
    transform: [
      { translateX: Math.sin(t.value * Math.PI * 2 * cfg.sway) * cfg.amp },
      { translateY: -30 + t.value * (h + 60) },
      { rotateZ: `${spin.value * 360}deg` },
      { rotateX: `${spin.value * 720}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left: cfg.x, top: 0, width: cfg.size, height: cfg.round ? cfg.size : cfg.size * 2.1, borderRadius: cfg.round ? cfg.size : 2, backgroundColor: cfg.color }, style]}
    />
  );
}

export function Confetti({ count = 28 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => <Piece key={i} i={i} h={height} w={width} />)}
    </View>
  );
}

function Star({ i, w, h }: { i: number; w: number; h: number }) {
  const o = useSharedValue(0.15);
  const size = 10 + rnd(i, 11) * 18;
  useEffect(() => {
    o.value = withDelay(rnd(i, 12) * 2200, withRepeat(withSequence(withTiming(1, { duration: 700 + rnd(i, 13) * 700 }), withTiming(0.1, { duration: 900 + rnd(i, 14) * 800 })), -1, false));
  }, [i, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.5 + o.value * 0.7 }, { rotateZ: `${o.value * 25}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: rnd(i, 15) * (w - size), top: 40 + rnd(i, 16) * (h * 0.78) }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 0C12 7 17 12 24 12C17 12 12 17 12 24C12 17 7 12 0 12C7 12 12 7 12 0Z" fill={rnd(i, 17) > 0.5 ? GOLD.light : '#FFFFFF'} />
      </Svg>
    </Animated.View>
  );
}

export function Sparkles({ count = 14 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => <Star key={i} i={i} w={width} h={height} />)}
    </View>
  );
}

function BurstPiece({ i, delay }: { i: number; delay: number }) {
  const t = useSharedValue(0);
  const cfg = useMemo(() => {
    // para cima e para os lados (o que sobe cai depois, pela gravidade)
    const angle = -Math.PI * (0.08 + rnd(i, 21) * 0.84);
    const dist = 110 + rnd(i, 22) * 190;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 6 + rnd(i, 23) * 7, spin: 2 + rnd(i, 24) * 4, color: COLORS[i % COLORS.length], round: rnd(i, 25) > 0.75 };
  }, [i]);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1500 + rnd(i, 26) * 500, easing: Easing.out(Easing.quad) }));
  }, [delay, i, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [
      { translateX: cfg.dx * t.value },
      { translateY: cfg.dy * t.value + 300 * t.value * t.value },
      { rotateZ: `${t.value * cfg.spin * 360}deg` },
      { rotateX: `${t.value * cfg.spin * 540}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: cfg.size, height: cfg.round ? cfg.size : cfg.size * 2, borderRadius: cfg.round ? cfg.size : 2, backgroundColor: cfg.color }, style]} />;
}

/** Explosão de confete que sai de um ponto (uma vez só), na hora em que a carta aparece. */
export function Burst({ x, y, count = 24, delay = 300 }: { x: number; y: number; count?: number; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y }}>
      {Array.from({ length: count }, (_, i) => <BurstPiece key={i} i={i} delay={delay} />)}
    </View>
  );
}

/**
 * Brilho atrás da carta da frente: raios azuis da marca girando devagar e um clarão que pulsa. `size` é o lado do
 * quadro (os raios somem na borda), centrado em (`cx`, `cy`).
 */
export function DeckAura({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    turn.value = withRepeat(withTiming(1, { duration: 46_000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })), -1, false);
  }, [reduce, turn, pulse]);
  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${turn.value * 360}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.75 + pulse.value * 0.25, transform: [{ scale: 0.96 + pulse.value * 0.08 }] }));
  const c = size / 2;
  const rays = useMemo(() => {
    const n = 16;
    const half = (Math.PI / n) * 0.52;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const p = (ang: number) => `${c + Math.cos(ang) * c} ${c + Math.sin(ang) * c}`;
      return `M${c} ${c} L${p(a - half)} L${p(a + half)} Z`;
    }).join(' ');
  }, [c]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: cx - c, top: cy - c, width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="auraRays" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={FX.cyan} stopOpacity={0.3} />
              <Stop offset="0.55" stopColor={FX.sky} stopOpacity={0.1} />
              <Stop offset="1" stopColor={FX.blue} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={rays} fill="url(#auraRays)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="auraGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="0.35" stopColor={FX.cyan} stopOpacity={0.28} />
              <Stop offset="0.7" stopColor={FX.blue} stopOpacity={0.14} />
              <Stop offset="1" stopColor={FX.blue} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill="url(#auraGlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
