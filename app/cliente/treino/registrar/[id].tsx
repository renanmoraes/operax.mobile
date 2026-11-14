import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Body, Button, Card, Field, Muted, Rise, Screen, Segmented, TopBar } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { partLabel, partLines } from '@/src/features/fitness/parts';
import { newIdempotencyKey, queueResults } from '@/src/features/fitness/resultsQueue';
import { useRecordResult } from '@/src/features/fitness/useFitness';
import type { FitnessWodLevel, FitnessWorkoutView } from '@/src/features/fitness/types';
import { isoDate } from '@/src/shared/format';
import { buildResult, maskClock } from '@/src/features/fitness/results';

export default function RegisterResultScreen() {
  const { id, parte } = useLocalSearchParams<{ id: string; parte?: string }>();
  return <WorkoutGate id={id} title="Registrar resultado">{(w) => <RegisterResult workout={w} partIndex={Number(parte ?? 0)} />}</WorkoutGate>;
}

const LEVELS: { key: FitnessWodLevel; label: string }[] = [
  { key: 'rx', label: 'Prescrito' },
  { key: 'scaled', label: 'Adaptado' },
  { key: 'beginner', label: 'Iniciante' },
];

function RegisterResult({ workout, partIndex }: { workout: FitnessWorkoutView; partIndex: number }) {
  const insets = useSafeAreaInsets();
  const part = workout.parts[partIndex] ?? workout.parts[0];
  const record = useRecordResult();
  const key = useMemo(() => newIdempotencyKey(), []);
  const [f, setF] = useState({ time: '', rounds: '', reps: '', kg: '', calories: '', meters: '', km: '' });
  const [level, setLevel] = useState<FitnessWodLevel>('rx');
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saved' | 'queued'>('idle');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: k === 'time' ? maskClock(v) : v }));

  async function save() {
    setError(null);
    const built = buildResult(part, f);
    if ('error' in built) {
      setError(built.error);
      return;
    }
    const body = {
      workout_id: workout.id,
      part_index: partIndex,
      executed_on: isoDate(new Date()),
      data: built.data,
      ...(part.type === 'metcon' ? { level } : {}),
      ...(effort ? { effort } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      idempotency_key: key,
    };
    try {
      await record.mutateAsync(body);
      setState('saved');
    } catch {
      // Sem internet: fica na fila e vai sozinho quando a conexão voltar.
      await queueResults([body]);
      setState('queued');
    }
  }

  const fields = (() => {
    if (part.type === 'metcon') {
      switch (part.result_type) {
        case 'time':
          return <Field label="Tempo (min:seg)" value={f.time} onChangeText={set('time')} placeholder="12:34" keyboardType="number-pad" />;
        case 'rounds_reps':
          return (
            <View style={styles.pair}>
              <View style={{ flex: 1 }}><Field label="Rounds" value={f.rounds} onChangeText={set('rounds')} placeholder="5" keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Repetições extras" value={f.reps} onChangeText={set('reps')} placeholder="12" keyboardType="number-pad" /></View>
            </View>
          );
        case 'reps':
          return <Field label="Repetições" value={f.reps} onChangeText={set('reps')} placeholder="120" keyboardType="number-pad" />;
        case 'load':
          return <Field label="Carga (kg)" value={f.kg} onChangeText={set('kg')} placeholder="60" keyboardType="decimal-pad" />;
        case 'calories':
          return <Field label="Calorias" value={f.calories} onChangeText={set('calories')} placeholder="80" keyboardType="number-pad" />;
        default:
          return <Field label="Distância (metros)" value={f.meters} onChangeText={set('meters')} placeholder="2000" keyboardType="number-pad" />;
      }
    }
    if (part.type === 'hyrox') return <Field label="Tempo total (h:min:seg)" value={f.time} onChangeText={set('time')} placeholder="1:15:00" keyboardType="number-pad" />;
    if (part.type === 'endurance')
      return (
        <View style={styles.pair}>
          <View style={{ flex: 1 }}><Field label="Tempo (min:seg)" value={f.time} onChangeText={set('time')} placeholder="32:10" keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Distância (km)" value={f.km} onChangeText={set('km')} placeholder="5,2" keyboardType="decimal-pad" /></View>
        </View>
      );
    return <Body>Confirme que fez esta parte do treino.</Body>;
  })();

  if (state !== 'idle') {
    return (
      <Screen>
        <TopBar safe title="Registrar resultado" onBack={() => router.back()} />
        <View style={[styles.done, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.doneTitle}>{state === 'saved' ? 'Resultado salvo!' : 'Guardado no celular'}</Text>
          <Muted style={{ textAlign: 'center', lineHeight: 20 }}>
            {state === 'saved' ? 'Já conta no seu histórico, na evolução e na meta da semana.' : 'Sem conexão agora. O resultado vai sozinho quando a internet voltar.'}
          </Muted>
          <Button label="Voltar ao treino" onPress={() => router.replace('/(client)/fitness')} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar safe title="Registrar resultado" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Rise>
            <Card style={{ padding: 18, gap: 8 }}>
              <Badge label={partLabel(part)} tone="primary" />
              <Text style={styles.title}>{workout.title}</Text>
              {partLines(part, workout.exercise_snapshots).slice(0, 6).map((l, i) => (
                <Muted key={i} style={{ lineHeight: 19 }}>{`• ${l}`}</Muted>
              ))}
            </Card>
          </Rise>
          {part.type === 'metcon' ? (
            <View>
              <Muted style={styles.label}>Como você fez</Muted>
              <Segmented value={level} onChange={(k) => setLevel(k as FitnessWodLevel)} options={LEVELS} />
            </View>
          ) : null}
          {fields}
          <View>
            <Muted style={styles.label}>Esforço (opcional)</Muted>
            <View style={styles.effort}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Text key={n} onPress={() => setEffort(effort === n ? null : n)} accessibilityRole="button" accessibilityState={{ selected: effort === n }} style={[styles.effortDot, effort === n && styles.effortOn]}>
                  {n}
                </Text>
              ))}
            </View>
          </View>
          <Field label="Comentário (opcional)" value={notes} onChangeText={setNotes} placeholder="Como foi?" multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Salvar resultado" icon="checkmark" loading={record.isPending} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...text.section, color: colors.text },
  pair: { flexDirection: 'row', gap: 10 },
  label: { marginBottom: 8, fontFamily: typography.fontFamilySemiBold },
  effort: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effortDot: { width: 40, height: 40, borderRadius: 20, textAlign: 'center', textAlignVertical: 'center', lineHeight: 40, overflow: 'hidden', backgroundColor: '#fff', color: colors.text, fontFamily: typography.fontFamilySemiBold },
  effortOn: { backgroundColor: colors.primary, color: '#fff' },
  error: { color: colors.dangerText, fontFamily: typography.fontFamilyMedium },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(244,247,252,0.96)' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  doneTitle: { ...text.title, color: colors.text, textAlign: 'center' },
  card: { borderRadius: radii.lg },
});
