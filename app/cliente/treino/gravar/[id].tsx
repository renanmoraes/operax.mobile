import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { WorkoutGate } from '@/src/features/fitness/WorkoutGate';
import { Recorder, type RecorderSave } from '@/src/features/fitness/Recorder';
import { partLabel, plannedMeters } from '@/src/features/fitness/parts';
import { enqueue, loadQueue, newIdempotencyKey, saveQueue } from '@/src/features/fitness/resultsQueue';
import { sportInfo } from '@/src/features/fitness/sports';
import { useRecordResult } from '@/src/features/fitness/useFitness';
import type { FitnessWorkoutView, RecordResultBody } from '@/src/features/fitness/types';
import { isoDate } from '@/src/shared/format';

/** Gravar com o GPS a parte de corrida, caminhada ou bike da ficha: o resultado entra no treino do dia. */
export default function GpsRecordScreen() {
  const { id, parte } = useLocalSearchParams<{ id: string; parte?: string }>();
  return <WorkoutGate id={id} title="Gravar treino">{(w) => <PlannedRecord workout={w} partIndex={Number(parte ?? 0)} />}</WorkoutGate>;
}

function PlannedRecord({ workout, partIndex }: { workout: FitnessWorkoutView; partIndex: number }) {
  const part = workout.parts[partIndex] ?? workout.parts[0];
  const sport = sportInfo(part.type === 'endurance' && part.sport === 'bike' ? 'bike' : 'run');
  const record = useRecordResult();
  const key = useMemo(() => newIdempotencyKey(), []);

  async function save(r: RecorderSave): Promise<'saved' | 'queued'> {
    const body: RecordResultBody = {
      workout_id: workout.id,
      part_index: partIndex,
      executed_on: isoDate(new Date(r.startedAt)),
      data: { kind: 'endurance', seconds: r.seconds, ...(r.distanceM >= 10 ? { distance_m: Math.round(r.distanceM) } : {}) },
      ...(r.feeling ? { feeling: r.feeling } : {}),
      ...(r.effort ? { effort: r.effort } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
      idempotency_key: key,
      recording: { started_at: new Date(r.startedAt).toISOString(), ...(r.track ? { track: r.track } : {}) },
    };
    try {
      await record.mutateAsync(body);
      return 'saved';
    } catch {
      await saveQueue(enqueue(await loadQueue(), body));
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
      draftKey={`ficha:${workout.id}:${partIndex}`}
      onSave={save}
      onClose={() => router.replace('/(client)/fitness')}
      onHistory={() => router.replace('/cliente/historico')}
    />
  );
}
