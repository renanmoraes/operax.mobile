import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Glow } from './ui';
import { colors, typography } from './tokens';

const MARK = require('@/assets/brand/operax-mark.png');
const NAVY = '#050a14';
const MIN_MS = 1500;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const T = (duration: number) => ({ duration, easing: EASE, reduceMotion: ReduceMotion.Never });

/**
 * Abertura da Operax. Emenda com o splash nativo (mesma marca no mesmo fundo azul-marinho):
 * a marca acende com um halo, o nome e o slogan sobem, uma linha de progresso corre e, quando
 * o app está pronto, tudo se abre com um leve zoom para a primeira tela.
 */
export function AnimatedSplash({ ready }: { ready: boolean }) {
  const [done, setDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const halo = useSharedValue(0.6);
  const word = useSharedValue(0);
  const bar = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    halo.set(withRepeat(withSequence(withTiming(1, T(900)), withTiming(0.6, T(900))), -1, false));
    word.set(withDelay(220, withTiming(1, T(700))));
    bar.set(withTiming(0.85, { duration: MIN_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    return () => clearTimeout(t);
  }, [halo, word, bar]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    bar.set(withTiming(1, T(260)));
    exit.set(withDelay(200, withTiming(1, T(520), (finished) => finished && runOnJS(setDone)(true))));
  }, [ready, minElapsed, bar, exit]);

  const root = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + exit.value * 0.12 }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value, transform: [{ scale: 0.9 + halo.value * 0.15 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 14 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  if (done) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, root]} pointerEvents={ready && minElapsed ? 'none' : 'auto'} accessible accessibilityLabel="Operax, carregando">
      <Glow size={520} color={colors.primary} opacity={0.35} style={{ top: -160, left: -180 }} />
      <Glow size={460} color={colors.cyan} opacity={0.16} style={{ bottom: -180, right: -170 }} />

      <View style={styles.center}>
        <Animated.View style={[styles.halo, haloStyle]}>
          <Glow size={300} color={colors.cyan} opacity={0.45} style={{ left: 0, top: 0 }} />
        </Animated.View>
        <Animated.View style={markStyle}>
          <Image source={MARK} style={styles.mark} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[styles.words, wordStyle]}>
          <Text style={styles.name}>OPERAX</Text>
          <Text style={styles.tagline}>ORGANIZE · OPERE · CRESÇA</Text>
        </Animated.View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.barWrap, barStyle]}>
          <LinearGradient colors={[colors.cyan, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, zIndex: 999, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 300, height: 300, marginTop: -64 },
  mark: { width: 112, height: 112 },
  words: { alignItems: 'center', marginTop: 28 },
  name: { fontFamily: typography.fontFamilyBold, fontSize: 30, letterSpacing: 10, color: '#fff', marginLeft: 10 },
  tagline: { fontFamily: typography.fontFamilySemiBold, fontSize: 10.5, letterSpacing: 3.2, color: 'rgba(160,214,255,0.72)', marginTop: 10, marginLeft: 3 },
  track: { position: 'absolute', left: 72, right: 72, bottom: 96, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barWrap: { height: 3, borderRadius: 2, overflow: 'hidden' },
});
