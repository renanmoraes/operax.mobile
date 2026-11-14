import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, text } from './tokens';

const MARK = require('@/assets/brand/operax-mark.png');
const SPIN = { duration: 1100, easing: Easing.linear, reduceMotion: ReduceMotion.Never };

/**
 * "Carregando" da Operax: a marca no centro com um arco em degradê (ciano → azul) girando
 * em volta e um leve respiro. Usado em telas inteiras e áreas que esperam o servidor.
 */
export function OperaxLoader({ size = 56, label, style, onDark }: { size?: number; label?: string; style?: StyleProp<ViewStyle>; onDark?: boolean }) {
  const turn = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    turn.set(withRepeat(withTiming(360, SPIN), -1, false));
    breathe.set(
      withRepeat(
        withSequence(
          withTiming(0.92, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        false,
      ),
    );
  }, [turn, breathe]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  const stroke = Math.max(2.5, size * 0.07);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="progressbar" accessibilityLabel={label ?? 'Carregando'}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? 'rgba(255,255,255,0.12)' : colors.track} strokeWidth={stroke} fill="none" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="operax-arc" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.cyan} />
                <Stop offset="1" stopColor={colors.primary} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="url(#operax-arc)"
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circ * 0.3} ${circ}`}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, mark]}>
          <Image source={MARK} style={{ width: size * 0.5, height: size * 0.5 }} contentFit="contain" />
        </Animated.View>
      </View>
      {label ? <Text style={[styles.label, onDark && { color: 'rgba(255,255,255,0.7)' }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { ...text.callout, color: colors.textMuted },
});
