import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, HeroCard, IconButton, IconTile, Muted, Num, PressableScale, Rise, Screen, SectionHeader, StatStrip, TopBar } from '@/src/design-system/ui';
import { colors, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { estimateMinutes, flattenWorkout, totalSets } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { useLoadHistory } from '@/src/features/fitness/useFitness';
import { partLabel, partLines, partMode, workoutChips } from '@/src/features/fitness/parts';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { openViewer } from '@/src/features/media/viewer';
import { clientDataMode } from '@/src/features/client/dataMode';
import { getAccessToken } from '@/src/shared/api/token-store';
import { API_URL } from '@/src/shared/config';
import type { FitnessWorkoutView } from '@/src/features/fitness/types';
import { formatKg, weekdayFull } from '@/src/shared/format';
import { useNow } from '@/src/shared/useNow';

export default function WorkoutSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <WorkoutGate id={id} title="Ficha do treino">
      {(workout) => <WorkoutSheet workout={workout} />}
    </WorkoutGate>
  );
}

function WorkoutSheet({ workout }: { workout: FitnessWorkoutView }) {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const LOAD_HISTORY = useLoadHistory();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const rows = flattenWorkout(workout);
  const hasStrength = rows.length > 0;
  const today = new Date().getDay();
  const isToday = workout.schedule.weekdays?.includes(today);
  const nextDay = workout.schedule.weekdays?.map((d) => (d - today + 7) % 7).filter((d) => d > 0).sort((a, b) => a - b)[0];
  const when = isToday ? 'Hoje' : nextDay === 1 ? 'Amanhã' : nextDay != null ? `Próxima ${weekdayFull(new Date(now + nextDay * 86_400_000))}` : '';
  const firstOther = workout.parts.findIndex((p) => partMode(p) !== 'sets');

  // Ficha em PDF do portal (com a sessão do aluno), aberta no visualizador do app.
  async function openPdf() {
    setPdfError(null);
    if (clientDataMode() !== 'live') {
      setPdfError('A ficha em PDF sai com o login real.');
      return;
    }
    setPdfBusy(true);
    try {
      const token = await getAccessToken('client');
      const target = `${cacheDirectory}ficha-${workout.id}.pdf`;
      const res = await downloadAsync(`${API_URL}/api/public/portal/fitness/workouts/${workout.id}/pdf`, target, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (res.status !== 200) throw new Error(String(res.status));
      openViewer({ kind: 'pdf', uri: res.uri, title: workout.title });
    } catch {
      setPdfError('Não foi possível baixar a ficha agora.');
    } finally {
      setPdfBusy(false);
    }
  }

  const start = (i: number) => {
    const mode = partMode(workout.parts[i]);
    if (mode === 'sets') router.push(`/cliente/treino/sessao/${workout.id}`);
    else if (mode === 'gps') router.push(`/cliente/treino/gravar/${workout.id}?parte=${i}`);
    else router.push(`/cliente/treino/registrar/${workout.id}?parte=${i}`);
  };
  const actionLabel = (i: number) => {
    const p = workout.parts[i];
    const mode = partMode(p);
    if (mode === 'gps') return p.type === 'endurance' && p.sport === 'bike' ? 'Gravar pedal com GPS' : 'Gravar corrida com GPS';
    if (mode === 'done') return 'Marcar como feito';
    return 'Registrar resultado';
  };

  return (
    <Screen>
      <TopBar safe title="Ficha do treino" onBack={() => router.back()} right={<IconButton icon="document-text-outline" accessibilityLabel="Abrir a ficha em PDF" onPress={() => void openPdf()} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        {pdfBusy ? <Muted style={styles.note}>Baixando a ficha…</Muted> : pdfError ? <Muted style={styles.note}>{pdfError}</Muted> : null}

        <Rise style={{ marginTop: 4 }}>
          <HeroCard>
            {when ? <Text style={styles.when}>{when}</Text> : null}
            <Text style={styles.title}>{workout.title}</Text>
            {hasStrength && workout.parts.length === 1 ? (
              <StatStrip
                style={styles.stats}
                items={[
                  { value: rows.length, label: rows.length === 1 ? 'exercício' : 'exercícios' },
                  { value: totalSets(rows), label: 'séries' },
                  { value: estimateMinutes(rows), label: 'minutos' },
                ]}
              />
            ) : (
              <View style={styles.chips}>
                {workoutChips(workout).map((c, k) => (
                  <Badge key={k} label={c} tone="primary" />
                ))}
              </View>
            )}
          </HeroCard>
        </Rise>

        {workout.coach_note ? (
          <Rise index={1} style={{ marginTop: 12 }}>
            <Card style={styles.noteCard}>
              <IconTile icon="chatbox-ellipses-outline" size={38} tone="soft" />
              <View style={{ flex: 1 }}>
                <Muted style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12.5 }}>Observação do professor</Muted>
                <Text style={styles.noteText}>{workout.coach_note}</Text>
              </View>
            </Card>
          </Rise>
        ) : null}

        {workout.parts.map((part, pi) => {
          if (part.type === 'strength') {
            const partRows = rows.filter((r) => r.partIndex === pi);
            return (
              <View key={pi}>
                <SectionHeader title={part.name || 'Exercícios'} />
                <View style={{ gap: 10 }}>
                  {partRows.map((r, i) => {
                    const hist = LOAD_HISTORY[r.exerciseId];
                    const last = hist?.[hist.length - 1];
                    return (
                      <Rise key={r.key} index={i + 2}>
                        <PressableScale onPress={() => router.push(`/cliente/exercicio/${r.exerciseId}?treino=${workout.id}`)} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.prescription}`} style={styles.row}>
                          <View style={styles.num}>
                            <Num size="sm" style={{ color: colors.primary }}>{i + 1}</Num>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.rowTitle}>{r.name}</Text>
                            <Muted style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{r.tag === 'Drop set' ? `${r.prescription} · ${r.loadLabel}` : r.prescription}</Muted>
                            {r.tag ? <View style={{ marginTop: 8 }}><Badge label={r.tag} tone="primary" /></View> : null}
                          </View>
                          {last != null ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Muted style={{ fontSize: 11.5 }}>última</Muted>
                              <Text style={styles.last}>{`${formatKg(last)} kg`}</Text>
                            </View>
                          ) : null}
                        </PressableScale>
                      </Rise>
                    );
                  })}
                </View>
              </View>
            );
          }
          const lines = partLines(part, workout.exercise_snapshots);
          return (
            <View key={pi}>
              <SectionHeader title={part.name || partLabel(part)} />
              <Card style={{ padding: 18, gap: 10 }}>
                <Badge label={partLabel(part)} tone="primary" />
                {lines.map((l, k) => (
                  <View key={k} style={styles.line}>
                    <View style={styles.dot} />
                    <Text style={styles.lineText}>{l}</Text>
                  </View>
                ))}
                {workout.parts.length > 1 || hasStrength ? (
                  <Button label={actionLabel(pi)} variant="soft" icon={partMode(part) === 'gps' ? 'navigate-outline' : 'create-outline'} onPress={() => start(pi)} style={{ marginTop: 6 }} />
                ) : null}
              </Card>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {hasStrength ? (
          <Button label="Começar treino" icon="play" onPress={() => router.push(`/cliente/treino/sessao/${workout.id}`)} />
        ) : firstOther >= 0 ? (
          <Button label={actionLabel(firstOther)} icon={partMode(workout.parts[firstOther]) === 'gps' ? 'navigate' : 'play'} onPress={() => start(firstOther)} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.primarySoft, color: colors.primaryDeep, lineHeight: 19 },
  when: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, color: colors.primary },
  title: { marginTop: 8, ...text.display, color: colors.text },
  stats: { marginTop: 20 },
  noteCard: { flexDirection: 'row', gap: 12, padding: 16 },
  noteText: { marginTop: 4, fontFamily: typography.fontFamily, fontSize: 14, lineHeight: 20, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, borderRadius: radii.xl - 2, backgroundColor: '#fff', ...shadows.card },
  num: { width: 56, height: 56, borderRadius: radii.lg - 4, backgroundColor: colors.primaryWash, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, lineHeight: 19, color: colors.text },
  last: { marginTop: 2, fontFamily: typography.fontFamilyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.primary },
  lineText: { flex: 1, fontFamily: typography.fontFamily, fontSize: 14.5, lineHeight: 21, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, backgroundColor: 'rgba(244,247,252,0.94)' },
});
