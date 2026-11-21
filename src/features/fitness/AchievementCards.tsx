import { useEffect, useRef, type RefObject } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { AchievementPin } from './AchievementPin';
import { GOLD } from './CelebrationFx';
import type { AchievementCard } from './achievements';

const GAP = 16;

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const longDate = (iso: string) => asDate(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
const monthYear = (iso: string) => asDate(iso).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }).replace(/\.|\s+de(?=\s)/gi, '').toUpperCase();

/** Lista das cartas: `useCardList()` dá a ref para o botão "Próxima carta" rolar para a seguinte. */
export type CardList = RefObject<FlatList<AchievementCard> | null>;
export const useCardList = (): CardList => useRef<FlatList<AchievementCard>>(null);

/**
 * Cartas das conquistas (sobre fundo preto), da mais recente para a mais antiga. Deslize ou toque: a carta da
 * vez fica grande no centro, com moldura dourada e um brilho que passa; as vizinhas encolhem, inclinam e esmaecem.
 * `onIndex` avisa qual está no centro; `onTap` é o toque na carta.
 */
export function AchievementCards({ won, list, onIndex, onTap }: { won: AchievementCard[]; list: CardList; onIndex?: (i: number) => void; onTap?: (i: number) => void }) {
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(310, width - 76);
  const cardH = Math.min(450, Math.max(350, height * 0.5));
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
      ref={list}
      data={won}
      horizontal
      keyExtractor={(i) => i.key}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      scrollEventThrottle={16}
      onScroll={onScroll}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: side, paddingVertical: 26, gap: GAP }}
      getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
      renderItem={({ item, index }) => <Card item={item} index={index} x={x} step={step} width={cardW} height={cardH} onTap={onTap} />}
    />
  );
}

function Card({ item, index, x, step, width, height, onTap }: { item: AchievementCard; index: number; x: SharedValue<number>; step: number; width: number; height: number; onTap?: (i: number) => void }) {
  const { t } = useTranslation('fitness');
  const reduce = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    sweep.value = withDelay(500 + (index % 3) * 400, withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }, undefined), -1, false));
  }, [reduce, index, sweep]);
  const anim = useAnimatedStyle(() => {
    const d = (x.value - index * step) / step; // 0 = no centro; -1 / 1 = vizinhas
    return {
      opacity: interpolate(Math.abs(d), [0, 1, 2], [1, 0.55, 0.3], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.86], Extrapolation.CLAMP) },
        { rotateZ: `${interpolate(d, [-1, 0, 1], [5, 0, -5], Extrapolation.CLAMP)}deg` },
        { translateY: interpolate(Math.abs(d), [0, 1], [0, 18], Extrapolation.CLAMP) },
      ],
    };
  });
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(sweep.value, [0, 0.45, 1], [-width * 1.2, width * 1.2, width * 1.2]) }, { rotateZ: '18deg' }] }));
  const c = item.color;
  const date = item.exact ? longDate(item.earned_at!) : t('ach.cards.edition', { year: item.editionYear ?? 0 });
  return (
    <Animated.View style={[{ width, height }, anim]}>
      <Pressable onPress={() => onTap?.(index)} accessibilityRole="button" accessibilityLabel={t('ach.cards.a11y', { name: item.name, date })} style={styles.card}>
        <LinearGradient colors={['#2a1c06', '#120d05', '#0a0a0c']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[`${c}40`, `${c}00`]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <View style={styles.top}>
          <Text style={styles.when}>{item.exact ? monthYear(item.earned_at!) : String(item.editionYear)}</Text>
          <View style={styles.xp}>
            <Text style={styles.xpText}>{t('ach.xp', { xp: item.xp.toLocaleString(locale()) })}</Text>
          </View>
        </View>
        {item.new ? (
          <View style={styles.fresh}>
            <Ionicons name="sparkles" size={12} color="#1a1204" />
            <Text style={styles.freshText}>{t('ach.cards.fresh').toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={styles.pinWrap}>
          <View style={[styles.halo, { backgroundColor: `${c}33`, shadowColor: c }]} />
          <View style={[styles.haloGold, { shadowColor: GOLD.main }]} />
          <AchievementPin item={item} size={136} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.55)" />
          <Text style={styles.date}>{date}</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.shine, shine]}>
          <LinearGradient colors={['#ffffff00', '#ffffff30', '#ffffff00']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, borderRadius: 32, borderWidth: 2, borderColor: GOLD.main, backgroundColor: '#0e0e10', overflow: 'hidden', shadowColor: GOLD.main, shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { fontFamily: typography.fontFamilyBold, fontSize: 12, letterSpacing: 1.8, color: 'rgba(255,255,255,0.55)' },
  xp: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: `${GOLD.main}aa`, backgroundColor: `${GOLD.main}22` },
  xpText: { fontFamily: typography.fontFamilyBold, fontSize: 12.5, color: GOLD.light },
  fresh: { position: 'absolute', top: 50, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: GOLD.main },
  freshText: { fontFamily: typography.fontFamilyBold, fontSize: 10.5, letterSpacing: 1, color: '#1a1204' },
  pinWrap: { marginTop: 14, width: 200, height: 170, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 172, height: 172, borderRadius: 86, shadowOpacity: 0.9, shadowRadius: 34, shadowOffset: { width: 0, height: 0 } },
  haloGold: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: `${GOLD.main}66`, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  name: { marginTop: 10, fontFamily: typography.fontFamilyBold, fontSize: 23, lineHeight: 28, textAlign: 'center', color: '#fff' },
  desc: { marginTop: 6, fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, textAlign: 'center', color: 'rgba(255,255,255,0.68)' },
  dateRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  shine: { position: 'absolute', top: -40, bottom: -40, width: 90 },
});
