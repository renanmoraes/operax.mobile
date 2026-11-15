import { LinearGradient } from 'expo-linear-gradient';
import i18n from '@/src/i18n';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii, shadows } from './tokens';

/**
 * Esqueleto de carregamento: blocos no formato do conteúdo que vai chegar, com um brilho
 * atravessando todos juntos (um relógio só por grupo), para a tela não parecer quebrada.
 */
const ShimmerCtx = createContext<SharedValue<number> | null>(null);

export function SkeletonGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }), -1, false));
  }, [t]);
  return (
    <ShimmerCtx.Provider value={t}>
      <View style={style} accessible accessibilityRole="progressbar" accessibilityLabel={i18n.t('states.loading')}>
        {children}
      </View>
    </ShimmerCtx.Provider>
  );
}

export function Skeleton({ width = '100%', height = 14, radius = 7, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const shared = useContext(ShimmerCtx);
  const own = useSharedValue(0);
  const t = shared ?? own;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!shared) own.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }), -1, false));
  }, [shared, own]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + t.value * w * 2 }] }));
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: '#e8edf5', overflow: 'hidden' }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View style={[StyleSheet.absoluteFill, { width: w }, sweep]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

type Variant = 'conversation' | 'channel' | 'contact' | 'agenda' | 'bubbles';

/** Listas prontas no formato de cada tela. */
export function SkeletonList({ variant, count = 5, style }: { variant: Variant; count?: number; style?: StyleProp<ViewStyle> }) {
  if (variant === 'bubbles') {
    return (
      <SkeletonGroup style={[{ gap: 12, padding: 16 }, style]}>
        {[62, 44, 70, 38, 56].slice(0, count).map((pct, i) => (
          <View key={i} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', width: `${pct}%` }}>
            <Skeleton height={i % 3 === 2 ? 64 : 42} radius={18} />
          </View>
        ))}
      </SkeletonGroup>
    );
  }
  if (variant === 'agenda') {
    return (
      <SkeletonGroup style={[{ gap: 14, paddingHorizontal: 16, paddingTop: 12 }, style]}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={40} height={12} style={{ marginTop: 4 }} />
            <View style={[styles.card, { flex: 1, height: i % 2 ? 64 : 86 }]}>
              <Skeleton width="35%" height={10} />
              <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
              <Skeleton width="45%" height={11} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </SkeletonGroup>
    );
  }
  const card = variant === 'conversation';
  return (
    <SkeletonGroup style={[card ? { gap: 10 } : styles.listCard, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[card ? [styles.card, styles.row] : [styles.row, styles.rowFlat, i < count - 1 && styles.rowBorder]]}>
          <Skeleton width={variant === 'channel' && i % 2 ? 48 : 48} height={48} radius={variant === 'channel' && i % 2 ? 16 : 24} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={`${46 + ((i * 13) % 24)}%`} height={13} />
              <Skeleton width={34} height={10} />
            </View>
            <Skeleton width={`${62 + ((i * 17) % 28)}%`} height={11} />
            {card ? <Skeleton width={72} height={18} radius={9} /> : null}
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 14, ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listCard: { backgroundColor: colors.cardBg, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  rowFlat: { paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
