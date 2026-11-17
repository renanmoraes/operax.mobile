import { router, useLocalSearchParams } from 'expo-router';
import i18n from '@/src/i18n';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Body, Button, Card, Field, Muted, Rise, Screen, Segmented, TopBar } from '@/src/design-system/ui';
import { colors, radii, text, typography } from '@/src/design-system/tokens';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { partLabel, partLines } from '@/src/features/fitness/parts';
import { fitnessOwner } from '@/src/features/fitness/owner';
import { isRejected, newIdempotencyKey, queueResults } from '@/src/features/fitness/resultsQueue';
import { useRecordResult } from '@/src/features/fitness/useFitness';
import type { FitnessWodLevel, FitnessWorkoutView } from '@/src/features/fitness/types';
import { isoDate } from '@/src/shared/format';
import { buildResult, maskClock } from '@/src/features/fitness/results';
import { KEYBOARD_BEHAVIOR } from '@/src/design-system/keyboard';

export default function RegisterResultScreen() {
  const { id, parte } = useLocalSearchParams<{ id: string; parte?: string }>();
  return <WorkoutGate id={id} title={i18n.t('fitness:sheet.logResult')}>{(w) => <RegisterResult workout={w} partIndex={Number(parte ?? 0)} />}</WorkoutGate>;
}

const level = (key: FitnessWodLevel) => ({ key, get label() { return i18n.t(`fitness:log.level.${key}`); } });
const LEVELS: { key: FitnessWodLevel; label: string }[] = [level('rx'), level('scaled'), level('beginner')];

function RegisterResult({ workout, partIndex }: { workout: FitnessWorkoutView; partIndex: number }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['fitness', 'common']);
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
    // De quem é o resultado: fixado antes de enviar. Se a pessoa trocar de conta no meio, a fila é a dela.
    const who = fitnessOwner();
    if (!who) return;
    try {
      await record.mutateAsync(body);
      setState('saved');
    } catch (e) {
      // Recusado pelo servidor: avisa e mantém o formulário para corrigir (na fila sumiria em silêncio).
      if (isRejected(e)) {
        setError(i18n.t('fitness:done.rejected'));
        return;
      }
      // Sem internet: fica na fila e vai sozinho quando a conexão voltar.
      try {
        await queueResults([body], who);
      } catch {
        // Nem no celular deu para guardar: mantém o formulário para tentar de novo.
        setError(i18n.t('fitness:offline.storeFail'));
        return;
      }
      setState('queued');
    }
  }

  const fields = (() => {
    if (part.type === 'metcon') {
      switch (part.result_type) {
        case 'time':
          return <Field label={t('log.timeMs')} value={f.time} onChangeText={set('time')} placeholder="12:34" keyboardType="number-pad" />;
        case 'rounds_reps':
          return (
            <View style={styles.pair}>
              <View style={{ flex: 1 }}><Field label={t('log.rounds')} value={f.rounds} onChangeText={set('rounds')} placeholder="5" keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('log.extraReps')} value={f.reps} onChangeText={set('reps')} placeholder="12" keyboardType="number-pad" /></View>
            </View>
          );
        case 'reps':
          return <Field label={t('log.reps')} value={f.reps} onChangeText={set('reps')} placeholder="120" keyboardType="number-pad" />;
        case 'load':
          return <Field label={t('log.load')} value={f.kg} onChangeText={set('kg')} placeholder="60" keyboardType="decimal-pad" />;
        case 'calories':
          return <Field label={t('log.calories')} value={f.calories} onChangeText={set('calories')} placeholder="80" keyboardType="number-pad" />;
        default:
          return <Field label={t('log.meters')} value={f.meters} onChangeText={set('meters')} placeholder="2000" keyboardType="number-pad" />;
      }
    }
    if (part.type === 'hyrox') return <Field label={t('log.totalTime')} value={f.time} onChangeText={set('time')} placeholder="1:15:00" keyboardType="number-pad" />;
    if (part.type === 'endurance')
      return (
        <View style={styles.pair}>
          <View style={{ flex: 1 }}><Field label={t('log.timeMs')} value={f.time} onChangeText={set('time')} placeholder="32:10" keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label={t('log.km')} value={f.km} onChangeText={set('km')} placeholder="5,2" keyboardType="decimal-pad" /></View>
        </View>
      );
    return <Body>{t('log.confirmDone')}</Body>;
  })();

  if (state !== 'idle') {
    return (
      <Screen>
        <TopBar safe title={t('sheet.logResult')} onBack={() => router.back()} />
        <View style={[styles.done, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.doneTitle}>{state === 'saved' ? t('log.saved') : t('rec.queued')}</Text>
          <Muted style={{ textAlign: 'center', lineHeight: 20 }}>
            {state === 'saved' ? t('log.savedBody') : t('log.queuedBody')}
          </Muted>
          <Button label={t('log.backToWorkout')} onPress={() => router.replace('/(client)/fitness')} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar safe title={t('sheet.logResult')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
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
              <Muted style={styles.label}>{t('log.howYouDid')}</Muted>
              <Segmented value={level} onChange={(k) => setLevel(k as FitnessWodLevel)} options={LEVELS} />
            </View>
          ) : null}
          {fields}
          <View>
            <Muted style={styles.label}>{t('log.effortOpt')}</Muted>
            <View style={styles.effort}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Text key={n} onPress={() => setEffort(effort === n ? null : n)} accessibilityRole="button" accessibilityState={{ selected: effort === n }} style={[styles.effortDot, effort === n && styles.effortOn]}>
                  {n}
                </Text>
              ))}
            </View>
          </View>
          <Field label={t('log.commentOpt')} value={notes} onChangeText={setNotes} placeholder={t('log.howWas')} multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={t('log.save')} icon="checkmark" loading={record.isPending} onPress={() => void save()} />
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
