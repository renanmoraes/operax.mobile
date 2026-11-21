import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { AchievementPin } from './AchievementPin';
import type { AchievementView } from './achievements';

const GAP = 16;

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const longDate = (iso: string) => asDate(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
const monthYear = (iso: string) => asDate(iso).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }).replace(/\.|\s+de(?=\s)/gi, '').toUpperCase();

/**
 * Cartas das conquistas (sobre fundo preto), da mais recente para a mais antiga. Deslize para o lado: a carta
 * da vez fica grande no centro, as vizinhas encolhem, inclinam e esmaecem. `onIndex` avisa qual está no centro.
 * `won` já vem ordenado.
 */
export function AchievementCards({ won, onIndex }: { won: AchievementView[]; onIndex?: (i: number) => void }) {
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(300, width - 84);
  const cardH = Math.min(430, Math.max(340, height * 0.5));
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  useAnimatedReaction(
    () => Math.round(x.value / step),
    (cur, prev) => {
      if (cur !== prev && onIndex) runOnJS(onIndex)(Math.max(0, Math.min(won.length - 1, cur)));
    },
  );
  return (
    <Animated.FlatList
      data={won}
      horizontal
      keyExtractor={(i) => i.ref}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEventThrottle={16}
      onScroll={onScroll}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: side, paddingVertical: 24, gap: GAP }}
      getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
      renderItem={({ item, index }) => <Card item={item} index={index} x={x} step={step} width={cardW} height={cardH} />}
    />
  );
}

function Card({ item, index, x, step, width, height }: { item: AchievementView; index: number; x: SharedValue<number>; step: number; width: number; height: number }) {
  const { t } = useTranslation('fitness');
  const anim = useAnimatedStyle(() => {
    const d = (x.value - index * step) / step; // 0 = no centro; -1 / 1 = vizinhas
    return {
      opacity: interpolate(Math.abs(d), [0, 1, 2], [1, 0.5, 0.25], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.86], Extrapolation.CLAMP) },
        { rotateZ: `${interpolate(d, [-1, 0, 1], [5, 0, -5], Extrapolation.CLAMP)}deg` },
        { translateY: interpolate(Math.abs(d), [0, 1], [0, 18], Extrapolation.CLAMP) },
      ],
    };
  });
  const c = item.color;
  return (
    <Animated.View style={[{ width, height }, anim]} accessible accessibilityLabel={t('ach.cards.a11y', { name: item.name, date: longDate(item.earned_at!) })}>
      <View style={[styles.card, { borderColor: `${c}88`, shadowColor: c }]}>
        <LinearGradient colors={[`${c}55`, `${c}12`, '#0b0c0f00']} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.75 }} style={StyleSheet.absoluteFill} />
        <View style={styles.top}>
          <Text style={[styles.when, { color: c }]}>{monthYear(item.earned_at!)}</Text>
          {item.new ? (
            <View style={[styles.fresh, { backgroundColor: c }]}>
              <Text style={styles.freshText}>{t('ach.cards.fresh').toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.pinWrap}>
          <View style={[styles.halo, { backgroundColor: `${c}30`, shadowColor: c }]} />
          <AchievementPin item={item} size={132} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.date}>{longDate(item.earned_at!)}</Text>
        <View style={[styles.xp, { backgroundColor: `${c}2b`, borderColor: `${c}66` }]}>
          <Text style={[styles.xpText, { color: c }]}>{t('ach.xp', { xp: item.xp.toLocaleString(locale()) })}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, borderRadius: 32, borderWidth: 1.5, backgroundColor: '#0e1014', overflow: 'hidden', shadowOpacity: 0.45, shadowRadius: 26, shadowOffset: { width: 0, height: 10 } },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 },
  when: { fontFamily: typography.fontFamilyBold, fontSize: 12, letterSpacing: 1.6 },
  fresh: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  freshText: { fontFamily: typography.fontFamilyBold, fontSize: 10.5, letterSpacing: 1, color: '#0b0c0f' },
  pinWrap: { marginTop: 8, width: 190, height: 168, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 168, height: 168, borderRadius: 84, shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  name: { marginTop: 10, fontFamily: typography.fontFamilyBold, fontSize: 21, lineHeight: 26, textAlign: 'center', color: '#fff' },
  desc: { marginTop: 6, fontFamily: typography.fontFamily, fontSize: 13.5, lineHeight: 19, textAlign: 'center', color: 'rgba(255,255,255,0.62)' },
  date: { marginTop: 10, fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  xp: { marginTop: 'auto', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  xpText: { fontFamily: typography.fontFamilyBold, fontSize: 12.5 },
});
