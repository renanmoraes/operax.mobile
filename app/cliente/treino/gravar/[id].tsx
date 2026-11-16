import { router, useLocalSearchParams } from 'expo-router';
import i18n from '@/src/i18n';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { Recorder, type RecorderSave } from '@/src/features/fitness/Recorder';
import { partLabel, plannedMeters } from '@/src/features/fitness/parts';
import { fitnessOwner } from '@/src/features/fitness/owner';
import { isRejected, queueResults, recordingKey } from '@/src/features/fitness/resultsQueue';
import { sportInfo } from '@/src/features/fitness/sports';
import { guideSteps } from '@/src/features/fitness/coach';
import { useRecordResult } from '@/src/features/fitness/useFitness';
import type { FitnessWorkoutView, RecordResultBody } from '@/src/features/fitness/types';
import { isoDate } from '@/src/shared/format';

/** Gravar com o GPS a parte de corrida, caminhada ou bike da ficha: o resultado entra no treino do dia. */
export default function GpsRecordScreen() {
  const { id, parte } = useLocalSearchParams<{ id: string; parte?: string }>();
  return <WorkoutGate id={id} title={i18n.t('fitness:recordWorkout')}>{(w) => <PlannedRecord workout={w} partIndex={Number(parte ?? 0)} />}</WorkoutGate>;
}

function PlannedRecord({ workout, partIndex }: { workout: FitnessWorkoutView; partIndex: number }) {
  const part = workout.parts[partIndex] ?? workout.parts[0];
  const sport = sportInfo(part.type === 'endurance' && part.sport === 'bike' ? 'bike' : 'run');
  const record = useRecordResult();

  async function save(r: RecorderSave): Promise<'saved' | 'queued'> {
    const body: RecordResultBody = {
      workout_id: workout.id,
      part_index: partIndex,
      executed_on: isoDate(new Date(r.startedAt)),
      data: { kind: 'endurance', seconds: r.seconds, ...(r.distanceM >= 10 ? { distance_m: Math.round(r.distanceM) } : {}) },
      ...(r.feeling ? { feeling: r.feeling } : {}),
      ...(r.effort ? { effort: r.effort } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
      idempotency_key: recordingKey(`ficha.${workout.id}.${partIndex}`, r.startedAt),
      recording: { started_at: new Date(r.startedAt).toISOString(), ...(r.track ? { track: r.track } : {}) },
    };
    // De quem é a gravação: fixado antes de enviar. Trocar de conta no meio não manda para a fila da outra.
    const who = fitnessOwner();
    if (!who) throw new Error('sem conta ativa');
    try {
      await record.mutateAsync(body);
      return 'saved';
    } catch (e) {
      // Recusado pelo servidor: a tela de salvar avisa e fica aberta (na fila sumiria em silêncio).
      if (isRejected(e)) throw e;
      await queueResults([body], who);
      return 'queued';
    }
  }

  return (
    <Recorder
      sport={sport}
      heading={partLabel(part)}
      subtitle={workout.title}
      goalMeters={plannedMeters(part)}
      askTitle={false}
      guide={guideSteps(part)}
      draftKey={`ficha:${workout.id}:${partIndex}`}
      resumeRoute={`/cliente/treino/gravar/${workout.id}?parte=${partIndex}`}
      onSave={save}
      onClose={() => router.replace('/(client)/fitness')}
      onHistory={() => router.replace('/cliente/historico')}
    />
  );
}
