import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useClientCapabilities } from '@/src/features/client/useClientData';
import { Recorder, type RecorderSave } from '@/src/features/fitness/Recorder';
import { newIdempotencyKey, queueActivity } from '@/src/features/fitness/resultsQueue';
import { SPORTS } from '@/src/features/fitness/sports';
import { useRecordFreeActivity } from '@/src/features/fitness/useFitness';
import type { FreeActivityBody } from '@/src/features/fitness/types';
import { isAxiosError } from 'axios';

/** Treino livre gravado no app: vai para o histórico do aluno (fonte Celular) e o professor acompanha. */
export default function FreeRecordScreen() {
  const { sport: id } = useLocalSearchParams<{ sport: string }>();
  const caps = useClientCapabilities();
  const sport = SPORTS.find((s) => s.id === id);
  const record = useRecordFreeActivity();
  const key = useMemo(() => newIdempotencyKey(), []);

  if (!sport || (caps.loaded && !caps.training)) return <Redirect href="/cliente/treinar" />;

  async function save(r: RecorderSave): Promise<'saved' | 'queued'> {
    const body: FreeActivityBody = {
      sport: sport!.id,
      started_at: new Date(r.startedAt).toISOString(),
      seconds: r.seconds,
      ...(sport!.gps && r.distanceM >= 10 ? { distance_m: Math.round(r.distanceM) } : {}),
      ...(sport!.gps ? { elevation_gain_m: Math.round(r.elevationGainM) } : {}),
      ...(r.title ? { title: r.title } : {}),
      ...(r.feeling ? { feeling: r.feeling } : {}),
      ...(r.effort ? { effort: r.effort } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
      ...(r.tag ? { tag: r.tag } : {}),
      ...(r.sets ? { sets: r.sets } : {}),
      idempotency_key: key,
      ...(r.track ? { recording: { track: r.track } } : {}),
    };
    try {
      await record.mutateAsync(body);
      return 'saved';
    } catch (e) {
      // Recusado pelo servidor (4xx) não adianta guardar: a tela avisa e a pessoa tenta de novo.
      const status = isAxiosError(e) ? (e.response?.status ?? 0) : 0;
      if (status >= 400 && status < 500) throw e;
      await queueActivity(body);
      return 'queued';
    }
  }

  return (
    <Recorder
      sport={sport}
      heading={sport.label}
      subtitle="Treino livre"
      askTitle
      askTag
      onPickSport={(next) => router.replace(`/cliente/treinar/${next}`)}
      draftKey={`livre:${sport.id}`}
      onSave={save}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/(client)/fitness'))}
      onHistory={() => router.replace('/cliente/historico')}
    />
  );
}
