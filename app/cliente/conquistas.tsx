import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { typography } from '@/src/design-system/tokens';
import { AchievementCards, useCardList } from '@/src/features/fitness/AchievementCards';
import { GoldTitle } from '@/src/features/fitness/GoldTitle';
import { Confetti, GOLD, Sparkles } from '@/src/features/fitness/CelebrationFx';
import { expandEarnedCards, useAchievements, useMarkAchievementsSeen, type AchievementCard } from '@/src/features/fitness/achievements';
import { ownedKey } from '@/src/features/fitness/owner';
import { kvGet, kvSet } from '@/src/shared/db/localDb';

const LIST = '/cliente/conquistas-lista' as never;
/** Marca de que esta conta já viu a comemoração pela primeira vez (depois, só quando houver conquista nova). */
const seenKey = () => ownedKey('operax_ach_gallery_seen');

/**
 * Comemoração das conquistas: tela preta e dourada com confete, "Parabéns" e as cartas passando no meio.
 * Aparece uma vez (com todas as conquistas já ganhas) e depois só quando há conquista nova, mostrando só as novas.
 * Sem nada a comemorar, abre direto a lista completa (`conquistas-lista`).
 */
export default function AchievementsGallery() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useTranslation(['fitness', 'common']);
  const { data, isError, refetch } = useAchievements();
  const { mutate } = useMarkAchievementsSeen();
  const list = useCardList();
  const [idx, setIdx] = useState(0);
  /** Cartas desta comemoração, fixadas na primeira vez (marcar como vistas não pode mexer nelas no meio). */
  const [deck, setDeck] = useState<{ cards: AchievementCard[]; firstTime: boolean; total: number } | 'none' | null>(null);

  useEffect(() => {
    if (!data || deck) return;
    let alive = true;
    void (async () => {
      const key = seenKey();
      const all = expandEarnedCards(data.items);
      const first = !!key && !(await kvGet<boolean>(key));
      const fresh = all.filter((c) => c.new);
      const cards = first ? all : fresh;
      if (!alive) return;
      if (!cards.length) {
        setDeck('none');
        return;
      }
      setDeck({ cards, firstTime: first, total: data.items.length });
      // Vista agora: sair e voltar não mostra de novo (só conquista nova).
      if (key) void kvSet(key, true);
      const refs = [...new Set(fresh.map((f) => f.ref))];
      if (refs.length) mutate(refs);
    })();
    return () => {
      alive = false;
    };
  }, [data, deck, mutate]);

  useEffect(() => {
    if (deck === 'none') router.replace(LIST);
  }, [deck]);

  const cards = deck && deck !== 'none' ? deck.cards : [];
  const last = cards.length > 0 && idx >= cards.length - 1;
  const next = useCallback(() => {
    if (last) router.replace(LIST);
    else void list.current?.scrollToIndex({ index: idx + 1, animated: true });
  }, [last, idx, list]);
  const glow = cards[Math.min(idx, cards.length - 1)]?.color ?? GOLD.main;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={['#2b1d06', '#0a0805', '#000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={[`${glow}33`, '#00000000']} start={{ x: 0.5, y: 0.35 }} end={{ x: 0.5, y: 0.8 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {cards.length ? <><Sparkles /><Confetti /></> : null}

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common:actions.close')} hitSlop={12} style={[styles.close, { top: insets.top + 10 }]}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.7)" />
          <Text style={styles.body}>{t('ach.loadFail')}</Text>
          <Pressable onPress={() => void refetch()} style={styles.ghost}><Text style={styles.ghostText}>{t('ach.retry')}</Text></Pressable>
        </View>
      ) : !cards.length ? (
        <View style={styles.center}><ActivityIndicator color={GOLD.main} /></View>
      ) : (
        <View style={[styles.main, { paddingTop: insets.top + (height < 700 ? 20 : 44) }]}>
          <Animated.View entering={ZoomIn.springify().damping(12).delay(100)} style={{ alignItems: 'center', paddingHorizontal: 8 }}>
            <Ionicons name="sparkles" size={26} color={GOLD.light} style={{ marginBottom: -4 }} />
            <GoldTitle text={`${t('ach.cards.congrats')}!`} size={height < 700 ? 40 : 50} />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(700).delay(250)} style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <Text style={styles.sub}>
              {deck && deck !== 'none' && !deck.firstTime ? t('ach.cards.unlocked', { count: cards.length }) : t('ach.cards.earnedOf', { count: cards.length })}
            </Text>
            <View style={styles.ornament}>
              <View style={styles.ornLine} />
              <Ionicons name="diamond" size={9} color={GOLD.main} />
              <View style={styles.ornLine} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(350).duration(800)} style={{ flex: 1, justifyContent: 'center' }}>
            <AchievementCards won={cards} list={list} onIndex={setIdx} onTap={(i) => (i === idx ? next() : list.current?.scrollToIndex({ index: i, animated: true }))} />
            <View style={styles.pill}><Text style={styles.pillText}>{t('ach.cards.position', { n: Math.min(idx, cards.length - 1) + 1, total: cards.length })}</Text></View>
            {cards.length > 1 ? (
              <View style={styles.dots} accessibilityElementsHidden>
                {cards.length <= 12
                  ? cards.map((c, i) => <View key={c.key} style={[styles.dot, i === idx && styles.dotOn]} />)
                  : <View style={styles.bar}><View style={[styles.barFill, { width: `${((idx + 1) / cards.length) * 100}%` }]} /></View>}
              </View>
            ) : null}
          </Animated.View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            {cards.length > 1 && !last ? (
              <View style={styles.hint}>
                <View style={styles.hintLine} />
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Ionicons name="swap-horizontal" size={20} color={GOLD.light} />
                  <Text style={styles.hintText}>{t('ach.cards.hint')}</Text>
                </View>
                <View style={styles.hintLine} />
              </View>
            ) : null}
            <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [{ alignSelf: 'stretch', opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <LinearGradient colors={[GOLD.light, GOLD.main, GOLD.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                <Text style={styles.ctaText}>{last ? t('ach.cards.finish') : t('ach.cards.next')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#1a1204" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  main: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  close: { position: 'absolute', right: 16, zIndex: 5, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  sub: { marginTop: 2, fontFamily: typography.fontFamilySemiBold, fontSize: 15, color: '#FFE9B0', textAlign: 'center', textShadowColor: GOLD.main, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  ornament: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ornLine: { width: 70, height: 1.5, borderRadius: 1, backgroundColor: `${GOLD.main}99` },
  body: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22, textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  pill: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  pillText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },
  dots: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: GOLD.main },
  bar: { width: 140, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: GOLD.main },
  footer: { paddingHorizontal: 24, gap: 12, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  hintLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  hintText: { fontFamily: typography.fontFamily, fontSize: 13, color: 'rgba(255,255,255,0.78)', textAlign: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 28, shadowColor: GOLD.main, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  ctaText: { fontFamily: typography.fontFamilyBold, fontSize: 17, color: '#1a1204' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' },
  ghostText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: '#fff' },
});
