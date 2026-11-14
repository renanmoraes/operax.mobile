import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, EmptyState, Glow, Loading, Muted, PressableScale, Rise, Screen, SectionHeader, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { useClientCapabilities } from '@/src/features/client/useClientData';
import { workoutChips } from '@/src/features/fitness/parts';
import { SPORTS, type SportInfo } from '@/src/features/fitness/sports';
import { useWeek } from '@/src/features/fitness/useFitness';

/**
 * Treinar: o treino do plano para hoje primeiro e, abaixo, o treino livre (corrida, caminhada, bike,
 * musculação…). Só para aluno com o Fitness liberado: o Operax não é um app de exercício solto, o livre
 * existe para o professor ver o que o aluno fez fora da ficha.
 */
export default function TrainHubScreen() {
  const insets = useSafeAreaInsets();
  const caps = useClientCapabilities();
  const week = useWeek({ enabled: caps.training });
  const [sport, setSport] = useState<SportInfo>(SPORTS[0]);

  if (!caps.loaded || (caps.training && week.isLoading)) {
    return (
      <Screen>
        <TopBar safe title="Treinar" onBack={() => router.back()} />
        <Loading label="Carregando seus treinos" />
      </Screen>
    );
  }
  if (!caps.training || week.isError) {
    return (
      <Screen>
        <TopBar safe title="Treinar" onBack={() => router.back()} />
        <EmptyState
          icon="barbell-outline"
          title="Treinos não liberados"
          subtitle="A gravação de treino fica disponível para quem tem plano de treino com a empresa. Fale com a equipe para liberar."
          actionLabel="Voltar"
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
      <TopBar safe title="Treinar" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Do seu plano hoje" />
        {items.length ? (
          <View style={{ gap: 10 }}>
            {items.map((it, i) => (
              <Rise key={it.id} index={i}>
                <PressableScale onPress={() => router.push(`/cliente/treino/${it.id}`)} accessibilityRole="button" accessibilityLabel={`${it.title}. Abrir treino`} style={styles.plan}>
                  <LinearGradient colors={['#1e4ed8', '#163db0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <Glow size={260} opacity={0.5} style={{ right: -90, top: -110 }} />
                  <View style={styles.rowBetween}>
                    <Badge label={doneToday ? 'Feito hoje' : 'Hoje'} tone={doneToday ? 'success' : 'primary'} />
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
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
            <Muted style={{ flex: 1, lineHeight: 19 }}>Nada planejado para hoje. Se treinar por conta, grave abaixo: entra no seu histórico e o professor acompanha.</Muted>
          </View>
        )}

        <SectionHeader title="Treino livre" />
        <View style={styles.grid}>
          {SPORTS.map((s, i) => {
            const on = s.id === sport.id;
            return (
              <Rise key={s.id} index={i} style={styles.cellWrap}>
                <PressableScale onPress={() => setSport(s)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={s.label} style={[styles.cell, on && styles.cellOn]}>
                  <MaterialCommunityIcons name={s.icon} size={30} color={on ? '#fff' : colors.primary} />
                  <Text style={[styles.cellLabel, on && { color: '#fff' }]} numberOfLines={1}>{s.label}</Text>
                  <Text style={[styles.cellHint, on && { color: 'rgba(255,255,255,0.78)' }]} numberOfLines={1}>{s.gps ? 'GPS e mapa' : 'Cronômetro'}</Text>
                </PressableScale>
              </Rise>
            );
          })}
        </View>
        <Muted style={{ marginTop: 12, lineHeight: 19 }}>
          {sport.gps ? 'Mede distância, ritmo, subida e desenha o caminho. No fim você conta como foi.' : 'Grava o tempo do treino. No fim você conta como foi e o esforço.'}
        </Muted>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button label={`Iniciar ${sport.label.toLowerCase()}`} icon="play" onPress={() => router.push(`/cliente/treinar/${sport.id}`)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plan: { borderRadius: radii.xl, padding: 20, overflow: 'hidden', minHeight: 132, ...shadows.hero },
  planTitle: { marginTop: 14, ...text.title, color: '#fff' },
  planChips: { marginTop: 6, fontFamily: typography.fontFamilyMedium, fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  noPlan: { flexDirection: 'row', gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: '#fff', ...shadows.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cellWrap: { width: '31%', flexGrow: 1 },
  cell: { height: 112, padding: 14, borderRadius: radii.lg, backgroundColor: '#fff', justifyContent: 'space-between', ...shadows.card },
  cellOn: { backgroundColor: colors.primary },
  cellLabel: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text },
  cellHint: { marginTop: -8, fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(244,247,252,0.96)', borderTopWidth: 1, borderColor: colors.borderSoft },
});
