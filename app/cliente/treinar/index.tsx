import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, EmptyState, Glow, Loading, Muted, PressableScale, Rise, Screen, SectionHeader, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useClientCapabilities } from '@/src/features/client/useClientData';
import { workoutChips } from '@/src/features/fitness/parts';
import { SPORTS } from '@/src/features/fitness/sports';
import { useWeek } from '@/src/features/fitness/useFitness';

/**
 * Treinar: o treino do plano para hoje primeiro e, abaixo, o treino livre (corrida, caminhada, bike,
 * musculação…). Só para aluno com o Fitness liberado: o Operax não é um app de exercício solto, o livre
 * existe para o professor ver o que o aluno fez fora da ficha.
 */
export default function TrainHubScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
  const caps = useClientCapabilities();
  const week = useWeek({ enabled: caps.training });

  if (!caps.loaded || (caps.training && week.isLoading)) {
    return (
      <Screen>
        <TopBar safe title={t('hub.title')} onBack={() => router.back()} />
        <Loading label={t('hub.loading')} />
      </Screen>
    );
  }
  if (!caps.training || week.isError) {
    return (
      <Screen>
        <TopBar safe title={t('hub.title')} onBack={() => router.back()} />
        <EmptyState
          icon="barbell-outline"
          title={t('hub.lockedTitle')}
          subtitle={t('hub.lockedSub')}
          actionLabel={t('common:actions.back')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const today = week.data?.days.find((d) => d.date === week.data?.today);
  const items = today?.items ?? [];
  const doneToday = (today?.done ?? 0) >= (today?.planned ?? 0) && (today?.planned ?? 0) > 0;

  return (
    <Screen>
      <TopBar safe title={t('hub.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <SectionHeader title={t('hub.today')} />
        {items.length ? (
          <View style={{ gap: 10 }}>
            {items.map((it, i) => (
              <Rise key={it.id} index={i}>
                <PressableScale onPress={() => router.push(`/cliente/treino/${it.id}`)} accessibilityRole="button" accessibilityLabel={t('hub.openWorkout', { title: it.title })} style={styles.plan}>
                  {/* 60-30-10: o cartão do treino de hoje é estrutura (navy) e a seta ciano é o impacto da tela. */}
                  <LinearGradient colors={[colors.chromeNavy, colors.chromeNavySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <Glow size={220} opacity={0.24} style={{ right: -80, top: -100 }} />
                  <View style={styles.rowBetween}>
                    <Badge label={doneToday ? t('hub.doneToday') : t('hub.todayBadge')} tone={doneToday ? 'success' : 'primary'} />
                    <View style={styles.planGo}>
                      <Ionicons name="arrow-forward" size={20} color={colors.impactFitnessText} />
                    </View>
                  </View>
                  <Text style={styles.planTitle} numberOfLines={2}>{it.title}</Text>
                  <Text style={styles.planChips} numberOfLines={1}>{workoutChips(it).join('  ·  ')}</Text>
                </PressableScale>
              </Rise>
            ))}
          </View>
        ) : (
          <View style={styles.noPlan}>
            <Ionicons name="calendar-clear-outline" size={20} color={colors.textMuted} />
            <Muted style={{ flex: 1, lineHeight: 19 }}>{t('hub.nothing')}</Muted>
          </View>
        )}

        <SectionHeader title={t('hub.free')} />
        <View style={styles.grid}>
          {SPORTS.map((s, i) => (
            // Um toque abre a gravação (a tela de largada já é a confirmação, com o GPS se preparando).
            <Rise key={s.id} index={i} style={styles.cellWrap}>
              <PressableScale onPress={() => router.push(`/cliente/treinar/${s.id}`)} accessibilityRole="button" accessibilityLabel={t('hub.openRecording', { sport: s.label })} style={styles.cell}>
                <View style={styles.cellTop}>
                  <MaterialCommunityIcons name={s.icon} size={30} color={colors.primary} />
                  <View style={styles.cellPlay}>
                    <Ionicons name="play" size={11} color="#fff" style={{ marginLeft: 1 }} />
                  </View>
                </View>
                <Text style={styles.cellLabel} numberOfLines={1}>{s.label}</Text>
                <Text style={styles.cellHint} numberOfLines={1}>{s.gps ? t('hub.gps') : s.id === 'swim' ? t('hub.timer') : t('hub.sets')}</Text>
              </PressableScale>
            </Rise>
          ))}
        </View>
        <Muted style={{ marginTop: 12, lineHeight: 19 }}>{t('hub.footer')}</Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plan: { borderRadius: radii.xl, padding: 20, overflow: 'hidden', minHeight: 132, ...shadows.hero },
  planGo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.impactFitness, alignItems: 'center', justifyContent: 'center' },
  planTitle: { marginTop: 14, ...text.title, color: '#fff' },
  planChips: { marginTop: 6, fontFamily: typography.fontFamilyMedium, fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  noPlan: { flexDirection: 'row', gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: '#fff', ...shadows.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cellWrap: { width: '31%', flexGrow: 1 },
  cell: { height: 112, padding: 14, borderRadius: radii.lg, backgroundColor: '#fff', justifyContent: 'space-between', ...shadows.card },
  cellTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cellPlay: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  cellHint: { marginTop: -8, fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted },
});
