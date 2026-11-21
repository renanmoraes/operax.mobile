import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { colors, typography } from '@/src/design-system/tokens';
import { AchievementDeck, type DeckHandle } from '@/src/features/fitness/AchievementDeck';
import { CelebrationTitle } from '@/src/features/fitness/CelebrationTitle';
import { Confetti, FX, GOLD, Sparkles } from '@/src/features/fitness/CelebrationFx';
import { playAchievementChime, stopAchievementChime } from '@/src/features/fitness/celebrationSound';
import { expandEarnedCards, useAchievements, useMarkAchievementsSeen, type AchievementCard } from '@/src/features/fitness/achievements';
import { ownedKey } from '@/src/features/fitness/owner';
import { kvGet, kvSet } from '@/src/shared/db/localDb';

const LIST = '/cliente/conquistas-lista' as never;
/** Marca de que esta conta já viu a comemoração pela primeira vez (depois, só quando houver conquista nova). */
const seenKey = () => ownedKey('operax_ach_gallery_seen');

/**
 * Comemoração das conquistas, nas cores da marca (azul-marinho, azul e ciano) com dourado só no prêmio.
 * Ao entrar tocam os sinos, surge a primeira carta com brilho e "Parabéns!", e a
 * pessoa passa as cartas com o dedo, como um baralho (`AchievementDeck`).
 * Aparece uma vez (com todas as conquistas já ganhas) e depois só quando há conquista nova, mostrando só as novas.
 * Sem nada a comemorar, abre direto a lista completa (`conquistas-lista`).
 */
export default function AchievementsCelebration() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useTranslation(['fitness', 'common']);
  const { data, isError, refetch } = useAchievements();
  const { mutate } = useMarkAchievementsSeen();
  const deckRef = useRef<DeckHandle>(null);
  const [idx, setIdx] = useState(0);
  /** Cartas desta comemoração, fixadas na primeira vez (marcar como vistas não pode mexer nelas no meio). */
  const [session, setSession] = useState<{ cards: AchievementCard[] } | 'none' | null>(null);

  useEffect(() => {
    if (!data || session) return;
    let alive = true;
    void (async () => {
      const key = seenKey();
      const all = expandEarnedCards(data.items);
      const first = !!key && !(await kvGet<boolean>(key));
      const fresh = all.filter((c) => c.new);
      const cards = first ? all : fresh;
      if (!alive) return;
      if (!cards.length) {
        setSession('none');
        return;
      }
      setSession({ cards });
      // Vista agora: sair e voltar não mostra de novo (só conquista nova).
      if (key) void kvSet(key, true);
      const refs = [...new Set(fresh.map((f) => f.ref))];
      if (refs.length) mutate(refs);
    })();
    return () => {
      alive = false;
    };
  }, [data, session, mutate]);

  useEffect(() => {
    if (session === 'none') router.replace(LIST);
  }, [session]);

  const cards = session && session !== 'none' ? session.cards : [];
  const celebrating = cards.length > 0;
  // Os sinos tocam junto com a entrada da primeira carta e param se a pessoa sair.
  useEffect(() => {
    if (!celebrating) return;
    void playAchievementChime();
    return stopAchievementChime;
  }, [celebrating]);

  const last = celebrating && idx >= cards.length - 1;
  const next = useCallback(() => {
    if (last) router.replace(LIST);
    else deckRef.current?.next();
  }, [last]);
  const small = height < 700;

  return (
    <View style={styles.root}>
      {/* Toma a tela inteira: entra esmaecendo e o gesto de voltar não disputa com o de passar a carta. */}
      <Stack.Screen options={{ animation: 'fade', gestureEnabled: false }} />
      <StatusBar style="light" />
      <LinearGradient colors={[FX.navySoft, '#0a1426', FX.navy]} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={['#00000000', `${FX.blue}4d`, '#00000000']} locations={[0.1, 0.5, 0.9]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {celebrating ? <Sparkles /> : null}

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common:actions.close')} hitSlop={12} style={[styles.close, { top: insets.top + 8 }]}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.7)" />
          <Text style={styles.body}>{t('ach.loadFail')}</Text>
          <Pressable onPress={() => void refetch()} accessibilityRole="button" style={styles.ghost}><Text style={styles.ghostText}>{t('ach.retry')}</Text></Pressable>
        </View>
      ) : !celebrating ? (
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      ) : (
        <View style={[styles.main, { paddingTop: insets.top + (small ? 6 : 14) }]}>
          <Animated.View entering={ZoomIn.springify().damping(12).delay(80)} style={styles.header}>
            <CelebrationTitle text={`${t('ach.cards.congrats')}!`} size={small ? 38 : 46} crest={!small} />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(600).delay(260)} style={styles.header}>
            <Text maxFontSizeMultiplier={1.2} style={styles.sub}>{t('ach.cards.unlocked', { count: cards.length })}</Text>
            <View style={styles.rule} />
          </Animated.View>

          <AchievementDeck ref={deckRef} cards={cards} onIndex={setIdx} />

          <Animated.View entering={FadeIn.delay(1100).duration(500)} style={{ alignItems: 'center' }}>
            <View style={styles.pill}><Text maxFontSizeMultiplier={1.2} style={styles.pillText}>{t('ach.cards.position', { n: Math.min(idx, cards.length - 1) + 1, total: cards.length })}</Text></View>
            {cards.length > 1 ? (
              <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {cards.length <= 12
                  ? cards.map((c, i) => <View key={c.key} style={[styles.dot, i === idx && styles.dotOn]} />)
                  : <View style={styles.bar}><View style={[styles.barFill, { width: `${((idx + 1) / cards.length) * 100}%` }]} /></View>}
              </View>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(1300).duration(500)} style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
            {cards.length > 1 && !small ? (
              <View style={[styles.hint, last && { opacity: 0 }]}>
                <View style={styles.hintLine} />
                <MaterialCommunityIcons name="gesture-swipe-horizontal" size={22} color="rgba(255,255,255,0.85)" />
                <Text maxFontSizeMultiplier={1.2} style={styles.hintText}>{t('ach.cards.hint')}</Text>
                <View style={styles.hintLine} />
              </View>
            ) : null}
            <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [{ alignSelf: 'stretch', opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              {/* Botão principal do app (azul da marca), com um fio ciano de luz. */}
              <LinearGradient colors={['#3D74F6', colors.primary]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.cta}>
                <Text maxFontSizeMultiplier={1.2} style={styles.ctaText}>{last ? t('ach.cards.finish') : t('ach.cards.next')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      )}
      {celebrating ? <Confetti /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Corta o que sai da tela (confete caindo, carta voando): na web, sem isso a página ganharia rolagem.
  root: { flex: 1, backgroundColor: FX.navy, overflow: 'hidden' },
  main: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  close: { position: 'absolute', right: 14, zIndex: 5, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  header: { alignItems: 'center', paddingHorizontal: 8 },
  sub: { marginTop: 4, paddingHorizontal: 12, fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.74)', textAlign: 'center' },
  rule: { marginTop: 10, width: 44, height: 2.5, borderRadius: 2, backgroundColor: GOLD.main },
  body: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22, textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  pill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  pillText: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },
  dots: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: GOLD.main },
  bar: { width: 140, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: GOLD.main },
  footer: { marginTop: 12, paddingHorizontal: 24, gap: 10, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  hintLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  hintText: { fontFamily: typography.fontFamily, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 28, borderWidth: 1, borderColor: `${FX.cyan}73`, shadowColor: FX.cyan, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  ctaText: { fontFamily: typography.fontFamilyBold, fontSize: 17, letterSpacing: -0.2, color: '#fff' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' },
  ghostText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: '#fff' },
});
