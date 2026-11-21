import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/** Efeitos de comemoração (confete caindo e brilhos piscando) nas cores douradas. Param com "reduzir movimento". */

export const GOLD = { light: '#FFE08A', main: '#F5B63A', deep: '#C98A12' };
const COLORS = [GOLD.light, GOLD.main, '#FFF6D6', '#FFFFFF', GOLD.deep, '#FFCF5C'];

/** Número "aleatório" fixo por posição (0–1): os mesmos pedaços a cada abertura, sem `Math.random` na renderização. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Piece({ i, h, w }: { i: number; h: number; w: number }) {
  const t = useSharedValue(0);
  const spin = useSharedValue(0);
  const cfg = useMemo(() => ({
    x: rnd(i, 1) * w, size: 8 + rnd(i, 2) * 8, dur: 4200 + rnd(i, 3) * 4200, delay: rnd(i, 4) * 4200,
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

export function Confetti({ count = 38 }: { count?: number }) {
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
