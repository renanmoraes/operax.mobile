import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { typography } from '@/src/design-system/tokens';
import { AchievementCards } from '@/src/features/fitness/AchievementCards';
import { useAchievements, useMarkAchievementsSeen } from '@/src/features/fitness/achievements';

/**
 * Conquistas: tela inteira preta, "Parabéns" no alto e as cartas das conquistas ganhas passando no meio
 * (da mais recente para a mais antiga). A lista completa, o nível e o que falta ganhar ficam em `conquistas-lista`.
 */
export default function AchievementsGallery() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const { data, isLoading, isError, refetch } = useAchievements();
  const seen = useMarkAchievementsSeen();
  const [idx, setIdx] = useState(0);

  const items = useMemo(() => data?.items ?? [], [data]);
  const won = useMemo(() => items.filter((i) => i.earned_at).sort((a, b) => b.earned_at!.localeCompare(a.earned_at!)), [items]);
  const current = won[Math.min(idx, won.length - 1)];

  // As novas aparecem marcadas nesta tela; ao sair o backend passa a tratá-las como vistas.
  const fresh = useRef<string[]>([]);
  useEffect(() => {
    fresh.current = won.filter((w) => w.new).map((w) => w.ref);
  }, [won]);
  const { mutate } = seen;
  useEffect(() => () => { if (fresh.current.length) mutate(fresh.current); }, [mutate]);

  const glow = current?.color ?? '#3b82f6';
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[`${glow}40`, '#00000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common:actions.close')} hitSlop={12} style={[styles.close, { top: insets.top + 10 }]}>
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.7)" />
          <Text style={styles.body}>{t('ach.loadFail')}</Text>
          <Pressable onPress={() => void refetch()} style={styles.ghost}><Text style={styles.ghostText}>{t('ach.retry')}</Text></Pressable>
        </View>
      ) : !won.length ? (
        <View style={styles.center}>
          <Text style={styles.title}>{t('ach.cards.emptyTitle')}</Text>
          <Text style={styles.body}>{t('ach.cards.emptyBody')}</Text>
        </View>
      ) : (
        <View style={[styles.main, { paddingTop: insets.top + 56 }]}>
          <Animated.View entering={FadeInDown.duration(700)} style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <Text style={styles.title} accessibilityRole="header">{t('ach.cards.congrats')}</Text>
            <Text style={styles.sub}>{t('ach.cards.earnedOf', { n: won.length, total: items.length })}</Text>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(300).duration(800)} style={{ flex: 1, justifyContent: 'center' }}>
            <AchievementCards won={won} onIndex={setIdx} />
            <Text style={styles.pos} accessibilityLiveRegion="polite">{`${Math.min(idx, won.length - 1) + 1} / ${won.length}`}</Text>
          </Animated.View>
        </View>
      )}

      {!isLoading ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={() => router.push('/cliente/conquistas-lista' as never)} accessibilityRole="button" style={styles.ghost}>
            <Text style={styles.ghostText}>{t('ach.cards.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  main: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  close: { position: 'absolute', right: 16, zIndex: 5, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 46, lineHeight: 56, color: '#fff', textAlign: 'center', letterSpacing: 0.3 },
  sub: { marginTop: 2, fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' },
  body: { fontFamily: typography.fontFamily, fontSize: 15, lineHeight: 22, textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  pos: { textAlign: 'center', fontFamily: typography.fontFamilySemiBold, fontSize: 12.5, color: 'rgba(255,255,255,0.45)', fontVariant: ['tabular-nums'] },
  footer: { alignItems: 'center', paddingTop: 8 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' },
  ghostText: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: '#fff' },
});
