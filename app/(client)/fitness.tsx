import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Display,
  Glow,
  HeroCard,
  IconButton,
  IconTile,
  Muted,
  Num,
  PressableScale,
  ProgressBar,
  ProgressRing,
  Rise,
  Screen,
  SectionHeader,
} from '@/src/design-system/ui';
import { GLASS_TAB_BAR_SPACE } from '@/src/design-system/GlassTabBar';
import { colors, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { flattenWorkout } from '@/src/features/fitness/flatten';
import { WORKOUTS } from '@/src/features/fitness/mockData';
import { useProviders } from '@/src/features/fitness/connections';
import { ProviderMark, providerDisplayName } from '@/src/features/fitness/brands';
import { useCheckins, useFitnessSummary, useWeek } from '@/src/features/fitness/useFitness';
import { formatKg, weekdayShort } from '@/src/shared/format';

export default function ClientFitnessScreen() {
  const insets = useSafeAreaInsets();
  const { data: week } = useWeek();
  const { data: summary } = useFitnessSummary();
  const { data: providers } = useProviders();
  const { data: checkins } = useCheckins();
  const [picked, setPicked] = useState<string | null>(null);

  const selectedDate = picked ?? week?.today;
  const day = week?.days.find((d) => d.date === selectedDate);
  const item = day?.items?.[0];
  const workout = item ? WORKOUTS.find((w) => w.id === item.id) : undefined;
  const rows = workout ? flattenWorkout(workout) : [];
  const isToday = selectedDate === week?.today;
  const isPast = !!selectedDate && !!week && selectedDate < week.today;
  const goal = 5;
  const done = week?.summary.done ?? 0;
  const connected = providers?.filter((p) => p.connected) ?? [];
  const firstCheck = checkins?.[0];
  const lastCheck = checkins?.[checkins.length - 1];
  const lost = firstCheck && lastCheck ? firstCheck.weight_kg - lastCheck.weight_kg : 0;

  const status = !day?.planned ? 'rest' : day.done ? 'done' : isToday ? 'today' : isPast ? 'missed' : 'next';
  const badge = { rest: ['Descanso', 'neutral'], done: ['Concluído', 'success'], today: ['Hoje', 'solid'], missed: ['Não feito', 'warn'], next: ['Próximo', 'neutral'] } as const;

  return (
    <Screen backdrop="mirror">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: GLASS_TAB_BAR_SPACE + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Display>Treino</Display>
          <PressableScale onPress={() => router.push('/cliente/historico')} accessibilityRole="button" accessibilityLabel={`Sequência de ${summary?.streak ?? 0} dias`} style={styles.streak}>
            <Ionicons name="flame-outline" size={17} color={colors.warn} />
            <Text style={styles.streakText}>{`${summary?.streak ?? '–'} dias`}</Text>
          </PressableScale>
        </View>

        <Rise style={{ marginTop: 16 }}>
          <HeroCard style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <ProgressRing progress={done / goal} accessibilityLabel={`Meta semanal: ${done} de ${goal} treinos`}>
                <Num size="lg">
                  {done}
                  <Text style={[numbers.sm, { color: colors.textMuted }]}>{`/${goal}`}</Text>
                </Num>
                <Muted style={{ fontSize: 11.5, marginTop: 2 }}>treinos</Muted>
              </ProgressRing>
              <View style={{ flex: 1, gap: 14 }}>
                <View>
                  <Muted style={{ fontSize: 12.5 }}>Meta da semana</Muted>
                  <Text style={styles.heroLine}>{done >= goal ? 'Meta batida. Que semana!' : `Faltam ${goal - done} treinos para fechar`}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View>
                    <Muted style={{ fontSize: 12 }}>Nível</Muted>
                    <Num size="sm" style={{ marginTop: 2 }}>{summary?.level.level ?? '–'}</Num>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.track }} />
                  <View>
                    <Muted style={{ fontSize: 12 }}>Consistência</Muted>
                    <Num size="sm" style={{ marginTop: 2, color: colors.primary }}>{`${summary?.consistency ?? '–'}%`}</Num>
                  </View>
                </View>
              </View>
            </View>
            {summary ? (
              <Pressable onPress={() => router.push('/cliente/conquistas')} accessibilityRole="button" accessibilityLabel="Ver nível e conquistas" style={{ marginTop: 16, gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Muted style={{ fontSize: 12 }}>{`${summary.level.label} · nível ${summary.level.level}`}</Muted>
                  <Muted style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>{`${summary.level.current.toLocaleString('pt-BR')} / ${summary.level.next.toLocaleString('pt-BR')} XP`}</Muted>
                </View>
                <ProgressBar progress={summary.level.current / summary.level.next} />
              </Pressable>
            ) : null}
          </HeroCard>
        </Rise>

        {summary ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <Card style={styles.memory}>
              <IconTile icon="sparkles-outline" size={36} />
              <Text style={styles.memoryText}>
                <Text style={{ fontFamily: typography.fontFamilyBold }}>{`Você treinou ${summary.monthCount}x este mês.`}</Text>
                <Text style={{ color: colors.textMuted }}> Bora manter o ritmo.</Text>
              </Text>
            </Card>
          </Rise>
        ) : null}

        <SectionHeader title="Sua semana" action="Hipertrofia · Fase 2" />
        <View style={styles.days}>
          {week?.days.map((d) => {
            const date = new Date(`${d.date}T12:00:00`);
            const on = d.date === selectedDate;
            const markColor = d.done ? (on ? '#fff' : colors.primary) : d.date === week.today && d.planned ? (on ? '#bfe9ff' : '#0094c6') : 'transparent';
            return (
              <Pressable
                key={d.date}
                onPress={() => setPicked(d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${weekdayShort(date)} ${date.getDate()}${d.done ? ', concluído' : d.planned ? '' : ', descanso'}`}
                style={[styles.day, on ? styles.dayOn : styles.dayOff]}
              >
                <Text style={[styles.dayWd, on && { color: 'rgba(255,255,255,0.8)' }]}>{weekdayShort(date)}</Text>
                <Text style={[styles.dayNum, on && { color: '#fff' }]}>{date.getDate()}</Text>
                <View style={[styles.dayMark, { backgroundColor: markColor }]} />
              </Pressable>
            );
          })}
        </View>

        <Rise index={2} style={{ marginTop: 12 }}>
          <Card style={{ padding: 20 }}>
            <View style={styles.rowBetween}>
              <Badge label={badge[status][0]} tone={badge[status][1]} />
              {workout ? <Muted>{`${rows.length} exercícios`}</Muted> : null}
            </View>
            <Text style={styles.dayTitle}>{workout ? workout.title : 'Descanso'}</Text>
            <Muted style={styles.daySub}>
              {status === 'rest'
                ? 'Dia livre. Se quiser, 10 minutos de alongamento ou uma caminhada leve.'
                : status === 'done'
                  ? 'Feito. Toque para ver o que você registrou.'
                  : workout?.coach_note ?? ''}
            </Muted>
            {status === 'today' && workout ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <Button label="Iniciar treino" icon="play" onPress={() => router.push(`/cliente/treino/${workout.id}`)} style={{ flex: 1 }} />
                <IconButton icon="list-outline" tone="soft" size={54} accessibilityLabel="Ver ficha" onPress={() => router.push(`/cliente/treino/${workout.id}`)} />
              </View>
            ) : status === 'done' ? (
              <Button label="Ver o que você fez" variant="soft" onPress={() => router.push('/cliente/historico')} style={{ marginTop: 18 }} />
            ) : workout ? (
              <Button label="Ver ficha" variant="soft" onPress={() => router.push(`/cliente/treino/${workout.id}`)} style={{ marginTop: 18 }} />
            ) : null}
          </Card>
        </Rise>

        <Rise index={3} style={{ marginTop: 12 }}>
          <Card style={styles.coach}>
            <Avatar initials="CM" size={46} />
            <View style={{ flex: 1 }}>
              <Muted style={{ fontSize: 12.5 }}>Seu personal</Muted>
              <Text style={styles.coachName}>Carlos Mendes</Text>
              <Muted style={{ marginTop: 2 }}>Semana 3 de 8 do plano</Muted>
            </View>
            <IconButton icon="chatbubble-outline" tone="soft" size={46} accessibilityLabel="Conversar com Carlos" onPress={() => router.push('/cliente/chat/move-studio')} />
          </Card>
        </Rise>

        <View style={styles.grid}>
          <Rise index={4} style={{ flex: 1 }}>
            <PressableScale onPress={() => router.push('/cliente/evolucao')} accessibilityRole="button" accessibilityLabel="Evolução corporal" style={[styles.tile, { overflow: 'hidden' }]}>
              <LinearGradient colors={['#eaf0ff', '#ddf3ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Glow size={160} opacity={0.45} style={{ right: -60, top: -70 }} />
              <Ionicons name="images-outline" size={22} color={colors.primary} />
              <Text style={[styles.tileTitle, { marginTop: 'auto' }]}>Evolução corporal</Text>
              <Muted style={{ marginTop: 2, color: colors.primaryDeep }}>{lost > 0 ? `−${formatKg(lost)} kg desde o início` : 'Registre sua primeira foto'}</Muted>
            </PressableScale>
          </Rise>
          <Rise index={5} style={{ flex: 1 }}>
            <PressableScale onPress={() => router.push('/cliente/conquistas')} accessibilityRole="button" accessibilityLabel="Conquistas" style={[styles.tile, { backgroundColor: '#fff' }]}>
              <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
              <Text style={[styles.tileTitle, { marginTop: 'auto' }]}>Conquistas</Text>
              <Muted style={{ marginTop: 2 }}>{`${summary?.records ?? 0} recordes pessoais`}</Muted>
            </PressableScale>
          </Rise>
        </View>

        <Rise index={6} style={{ marginTop: 12 }}>
          <Card onPress={() => router.push('/cliente/relogios')} accessibilityLabel="Relógios e apps" style={styles.coach}>
            {connected[0] ? <ProviderMark id={connected[0].id} label={connected[0].label} size={46} /> : <IconTile icon="watch-outline" size={46} tone="soft" />}
            <View style={{ flex: 1 }}>
              <Text style={styles.coachName}>Relógios e apps</Text>
              <Muted style={{ marginTop: 2 }}>{connected.length ? `${connected.map((p) => providerDisplayName(p.id, p.label)).join(', ')} conectado` : 'Conecte Garmin Connect™, Strava ou Polar'}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </Rise>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.warnSoft },
  streakText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.warn },
  heroLine: { marginTop: 3, ...text.section, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radii.lg },
  memoryText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 72, borderRadius: radii.lg - 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayOn: { backgroundColor: colors.primary, ...shadows.button },
  dayOff: { backgroundColor: 'rgba(255,255,255,0.88)' },
  dayWd: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textMuted },
  dayNum: { ...numbers.sm, color: colors.text },
  dayMark: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dayTitle: { marginTop: 14, ...text.title, color: colors.text },
  daySub: { marginTop: 6, fontSize: 13.5, lineHeight: 20 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  coachName: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  tile: { minHeight: 132, padding: 18, borderRadius: radii.xl, ...shadows.card },
  tileTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
});
