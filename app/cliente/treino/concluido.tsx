import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Field, Glow, IconButton, IconName, Muted, Rise, Screen, StatStrip } from '@/src/design-system/ui';
import { colors, gradients, numbers, radii, shadows, text, typography } from '@/src/design-system/tokens';
import { buildResultBodies, flattenWorkout, totalSets } from '@/src/features/fitness/flatten';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { enqueue, loadQueue, saveQueue } from '@/src/features/fitness/resultsQueue';
import { clearFinishedSession, FinishedSession, getFinishedSession, loadFinishedSession, resultKeyOf } from '@/src/features/fitness/sessionStore';
import type { FitnessFeeling, FitnessWorkoutView } from '@/src/features/fitness/types';
import { useHistory, useLoadHistory, useRecordResult } from '@/src/features/fitness/useFitness';
import { formatClock, formatKg, isoDate } from '@/src/shared/format';

const FEELINGS: { key: FitnessFeeling; label: string; icon: IconName }[] = [
  { key: 'great', label: 'Ótimo', icon: 'happy-outline' },
  { key: 'good', label: 'Bom', icon: 'thumbs-up-outline' },
  { key: 'ok', label: 'Ok', icon: 'remove-circle-outline' },
  { key: 'bad', label: 'Puxado', icon: 'trending-down-outline' },
  { key: 'awful', label: 'Péssimo', icon: 'sad-outline' },
];

export default function WorkoutDoneScreen() {
  const [session, setSession] = useState<FinishedSession | null>(() => getFinishedSession());
  // App fechado e reaberto nesta tela: recupera o treino terminado gravado no aparelho.
  useEffect(() => {
    if (session) return;
    void loadFinishedSession().then((s) => s && setSession(s));
  }, [session]);
  return <WorkoutGate id={session?.workoutId}>{(workout) => <WorkoutDone workout={workout} session={session} />}</WorkoutGate>;
}

function WorkoutDone({ workout, session }: { workout: FitnessWorkoutView; session: FinishedSession | null }) {
  const insets = useSafeAreaInsets();
  const LOAD_HISTORY = useLoadHistory();
  const rows = useMemo(() => flattenWorkout(workout), [workout]);
  const { data: history } = useHistory();
  const record = useRecordResult();
  const [feeling, setFeeling] = useState<FitnessFeeling | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [queued, setQueued] = useState(false);

  const logs = session?.logs ?? rows.map(() => []);
  const setsDone = logs.reduce((n, l) => n + l.length, 0);
  const volume = Math.round(logs.reduce((n, l) => n + l.reduce((m, s) => m + s.kg * s.reps, 0), 0));
  const records = rows
    .map((r, i) => {
      const top = Math.max(0, ...logs[i].map((s) => s.kg));
      const prev = LOAD_HISTORY[r.exerciseId] ? Math.max(...LOAD_HISTORY[r.exerciseId]) : null;
      return prev != null && top > prev ? { name: r.name, kg: top, diff: top - prev } : null;
    })
    .filter(Boolean) as { name: string; kg: number; diff: number }[];

  const past = (history ?? []).filter((e) => e.title === workout.title).slice(0, 5).reverse();
  const bars = [...past.map((e) => ({ label: e.date.slice(8, 10) + '/' + e.date.slice(5, 7), v: e.volume_kg ?? 0 })), { label: 'Hoje', v: volume }];
  const maxV = Math.max(1, ...bars.map((b) => b.v));

  async function save() {
    if (queued || record.isPending) return;
    // Mesma chave em toda tentativa (vem do treino terminado): repetir nunca grava duas vezes.
    const bodies = buildResultBodies(rows, logs, {
      workout_id: workout.id,
      executed_on: isoDate(session ? new Date(session.finishedAt) : new Date()),
      idempotency_key: session ? resultKeyOf(session) : `${workout.id}-${isoDate(new Date())}`,
      effort: effort ?? undefined,
      feeling: feeling ?? undefined,
      notes: comment.trim() || undefined,
    });
    let sent = 0;
    try {
      for (const body of bodies) {
        await record.mutateAsync(body);
        sent += 1;
      }
      await clearFinishedSession(workout.id);
      router.replace('/(client)/fitness');
    } catch {
      let queue = await loadQueue();
      for (const body of bodies.slice(sent)) queue = enqueue(queue, body);
      await saveQueue(queue);
      // Já está guardado na fila para enviar depois: pode liberar o rascunho e não envia de novo daqui.
      await clearFinishedSession(workout.id);
      setQueued(true);
    }
  }

  return (
    <Screen backdrop="none">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <LinearGradient colors={['#ffffff', '#eaf1ff', '#dff3ff']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={360} opacity={0.4} style={{ alignSelf: 'center', top: -120 }} />
          <View style={{ alignItems: 'flex-end', paddingHorizontal: 20 }}>
            <IconButton icon="close" accessibilityLabel="Fechar" onPress={() => router.replace('/(client)/fitness')} />
          </View>
          <Rise style={{ alignItems: 'center' }}>
            <LinearGradient colors={gradients.brand} style={styles.trophy}>
              <Ionicons name="trophy-outline" size={38} color="#fff" />
            </LinearGradient>
          </Rise>
          <Rise index={1}>
            <Text style={styles.title}>Treino concluído!</Text>
          </Rise>
          <Rise index={2}>
            <Muted style={styles.sub}>{`${workout.title} · ${setsDone} de ${totalSets(rows)} séries`}</Muted>
          </Rise>
          <Rise index={3} style={styles.stats}>
            <StatStrip
              align="center"
              items={[
                { value: formatClock(session?.elapsed ?? 0), label: 'tempo' },
                { value: volume.toLocaleString('pt-BR'), label: 'kg de volume' },
                { value: `${setsDone}/${totalSets(rows)}`, label: 'séries' },
              ]}
            />
          </Rise>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 16 }}>
          {records.length ? (
            <Rise index={4}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="flash-outline" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>{records.length === 1 ? '1 novo recorde' : `${records.length} novos recordes`}</Text>
                </View>
                {records.map((r) => (
                  <View key={r.name} style={styles.record}>
                    <Text style={styles.recordName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.recordValue}>{`${formatKg(r.kg)} kg  +${formatKg(r.diff)}`}</Text>
                  </View>
                ))}
              </Card>
            </Rise>
          ) : null}

          <Rise index={5}>
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{`Volume no ${workout.title.split('·')[0].trim()}`}</Text>
                <Muted>{`últimas ${bars.length} vezes`}</Muted>
              </View>
              <View style={styles.bars} accessible accessibilityLabel={`Volume de hoje: ${volume} kg`}>
                {bars.map((b, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    {i === bars.length - 1 ? (
                      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 92) }]} />
                    ) : (
                      <View style={[styles.bar, { height: Math.max(8, (b.v / maxV) * 92), backgroundColor: i === bars.length - 2 ? '#bfd0f7' : '#e5e9f0' }]} />
                    )}
                    <Text style={[styles.barLabel, i === bars.length - 1 && { color: colors.primary, fontFamily: typography.fontFamilyBold }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Rise>

          <Rise index={6}>
            <Card>
              <Text style={styles.cardTitle}>Como foi o treino?</Text>
              <Muted style={{ marginTop: 4 }}>{`Vai junto com o resultado para ${workout.contact_name?.split(' ')[0] ?? 'seu personal'}.`}</Muted>
              <View style={styles.feelings} accessibilityRole="radiogroup">
                {FEELINGS.map((f) => {
                  const on = feeling === f.key;
                  return (
                    <Pressable key={f.key} onPress={() => setFeeling(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={f.label} style={[styles.feeling, on && styles.feelingOn]}>
                      <Ionicons name={f.icon} size={22} color={on ? '#fff' : colors.textSoft} />
                      <Text style={[styles.feelingText, on && { color: '#fff' }]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 16 }]}>Esforço (0 a 10)</Text>
              <View style={styles.efforts}>
                {Array.from({ length: 11 }, (_, n) => (
                  <Pressable key={n} onPress={() => setEffort(n)} accessibilityRole="radio" accessibilityState={{ checked: effort === n }} accessibilityLabel={`Esforço ${n}`} style={[styles.effort, effort === n && styles.feelingOn]}>
                    <Text style={[styles.effortText, effort === n && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ marginTop: 14 }}>
                <Field label="Comentário (opcional)" value={comment} onChangeText={setComment} multiline placeholder="Conte como você se sentiu" />
              </View>
            </Card>
          </Rise>

          <Rise index={7}>
            <Card style={styles.share}>
              <LinearGradient colors={gradients.media} style={styles.story}>
                <Text style={styles.storyTime}>{formatClock(session?.elapsed ?? 0)}</Text>
                <Text style={styles.storyHandle}>Move Studio</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Compartilhar</Text>
                <Muted style={{ marginTop: 3, lineHeight: 18 }}>{feeling ? 'Mande o resumo para Instagram, WhatsApp e mais.' : 'Diga como foi para liberar o compartilhamento.'}</Muted>
                {feeling ? (
                  <Button
                    label="Compartilhar"
                    compact
                    icon="share-outline"
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    onPress={() => void Share.share({ message: `Treino concluído: ${workout.title}, ${formatClock(session?.elapsed ?? 0)} e ${volume.toLocaleString('pt-BR')} kg de volume.` })}
                  />
                ) : null}
              </View>
            </Card>
          </Rise>

          {queued ? <Body style={styles.queued}>Sem conexão agora. O resultado ficou guardado e vai sozinho quando a internet voltar.</Body> : null}
          {queued ? (
            <Button label="Voltar ao treino" onPress={() => router.replace('/(client)/fitness')} />
          ) : (
            <Button label="Salvar e voltar" loading={record.isPending} onPress={() => void save()} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 28, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', ...shadows.hero },
  trophy: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  title: { marginTop: 18, textAlign: 'center', ...text.display, color: colors.text },
  sub: { marginTop: 6, textAlign: 'center', fontSize: 14.5 },
  stats: { marginTop: 22, paddingHorizontal: 20 },
  cardTitle: { fontFamily: typography.fontFamilyBold, fontSize: 15, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  record: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.md + 4, backgroundColor: colors.primarySoft },
  recordName: { flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 14, color: colors.text },
  recordValue: { ...numbers.xs, color: colors.primaryDeep },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 14 },
  bar: { width: '100%', borderRadius: 10 },
  barLabel: { fontFamily: typography.fontFamily, fontSize: 11.5, color: colors.textMuted },
  feelings: { flexDirection: 'row', gap: 6, marginTop: 14 },
  feeling: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radii.md + 4, backgroundColor: '#f0f2f5' },
  feelingOn: { backgroundColor: colors.primary },
  feelingText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11.5, color: colors.textSoft },
  efforts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  effort: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  effortText: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.textSoft },
  share: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  story: { width: 62, height: 96, borderRadius: 14, padding: 8, justifyContent: 'flex-end' },
  storyTime: { color: '#fff', fontFamily: typography.fontFamilyBold, fontSize: 12 },
  storyHandle: { color: '#dce6ff', fontFamily: typography.fontFamily, fontSize: 8 },
  queued: { fontSize: 13.5, color: colors.warnText, textAlign: 'center' },
});
