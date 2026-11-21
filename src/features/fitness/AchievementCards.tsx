import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Muted, PressableScale } from '@/src/design-system/ui';
import { colors, radii, shadows, typography } from '@/src/design-system/tokens';
import { locale } from '@/src/i18n';
import { AchievementPin } from './AchievementPin';
import type { AchievementView } from './achievements';

const CARD_H = 292;
const GAP = 14;

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const longDate = (iso: string) => asDate(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
const monthYear = (iso: string) => asDate(iso).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }).replace(/\.|\s+de(?=\s)/gi, '').toUpperCase();

/**
 * Cartas das conquistas ganhas, da mais recente para a mais antiga: deslize para o lado e a carta da vez
 * fica em destaque (as vizinhas encolhem e inclinam um pouco). Tocar abre o detalhe.
 */
export function AchievementCards({ items, onOpen }: { items: AchievementView[]; onOpen: (i: AchievementView) => void }) {
  const { t } = useTranslation('fitness');
  const { width } = useWindowDimensions();
  const cardW = Math.min(250, width - 96);
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const won = useMemo(() => items.filter((i) => i.earned_at).sort((a, b) => b.earned_at!.localeCompare(a.earned_at!)), [items]);

  if (!won.length) {
    return (
      <View style={styles.empty}>
        <Muted style={{ textAlign: 'center' }}>{t('ach.cards.empty')}</Muted>
      </View>
    );
  }
  return (
    <View style={{ marginHorizontal: -20 }}>
      <Muted style={{ marginHorizontal: 20, marginBottom: 6, fontSize: 12.5 }}>{t('ach.cards.hint')}</Muted>
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
        contentContainerStyle={{ paddingHorizontal: side, paddingVertical: 14, gap: GAP }}
        renderItem={({ item, index }) => <Card item={item} index={index} total={won.length} x={x} step={step} width={cardW} onOpen={onOpen} />}
        getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
      />
    </View>
  );
}

function Card({ item, index, total, x, step, width, onOpen }: { item: AchievementView; index: number; total: number; x: SharedValue<number>; step: number; width: number; onOpen: (i: AchievementView) => void }) {
  const { t } = useTranslation('fitness');
  const anim = useAnimatedStyle(() => {
    const d = (x.value - index * step) / step; // 0 = carta no centro; -1/1 = vizinhas
    return {
      opacity: interpolate(Math.abs(d), [0, 1, 2], [1, 0.72, 0.5], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.9], Extrapolation.CLAMP) },
        { rotateZ: `${interpolate(d, [-1, 0, 1], [3, 0, -3], Extrapolation.CLAMP)}deg` },
      ],
    };
  });
  const date = longDate(item.earned_at!);
  return (
    <Animated.View style={[{ width, height: CARD_H }, anim]}>
      <PressableScale onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={t('ach.cards.a11y', { name: item.name, date })} style={[styles.card, { borderColor: `${item.color}66` }]}>
        <LinearGradient colors={[`${item.color}40`, `${item.color}0d`, '#ffffff00']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 0.7 }} style={StyleSheet.absoluteFill} />
        <View style={styles.top}>
          <Text style={[styles.when, { color: item.color }]}>{monthYear(item.earned_at!)}</Text>
          <Text style={styles.pos}>{t('ach.cards.position', { n: index + 1, total })}</Text>
        </View>
        <View style={styles.pinWrap}>
          <View style={[styles.halo, { backgroundColor: `${item.color}26` }]} />
          <AchievementPin item={item} size={112} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.date}>{date}</Text>
        <View style={[styles.xp, { backgroundColor: `${item.color}22` }]}>
          <Text style={[styles.xpText, { color: item.color }]}>{t('ach.xp', { xp: item.xp.toLocaleString(locale()) })}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 20, borderRadius: radii.xl - 4, backgroundColor: '#fff', ...shadows.card },
  card: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, borderRadius: 28, borderWidth: 1.5, backgroundColor: '#fff', overflow: 'hidden', ...shadows.card },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { fontFamily: typography.fontFamilyBold, fontSize: 11.5, letterSpacing: 1.2 },
  pos: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  pinWrap: { marginTop: 10, width: 150, height: 130, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  name: { marginTop: 10, fontFamily: typography.fontFamilyBold, fontSize: 17, lineHeight: 22, textAlign: 'center', color: colors.text },
  date: { marginTop: 4, fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: colors.textSoft },
  xp: { marginTop: 'auto', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  xpText: { fontFamily: typography.fontFamilyBold, fontSize: 12 },
});
