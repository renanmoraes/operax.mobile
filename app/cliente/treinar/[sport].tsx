import { Redirect, router, useLocalSearchParams } from 'expo-router';
import i18n from '@/src/i18n';
import { useClientCapabilities } from '@/src/features/client/useClientData';
import { Recorder, type RecorderSave } from '@/src/features/fitness/Recorder';
import { fitnessOwner } from '@/src/features/fitness/owner';
import { queueActivity, recordingKey } from '@/src/features/fitness/resultsQueue';
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

  if (!sport || (caps.loaded && !caps.training)) return <Redirect href="/cliente/treinar" />;

  async function save(r: RecorderSave): Promise<'saved' | 'queued'> {
    const body: FreeActivityBody = {
      sport: sport!.id,
      started_at: new Date(r.startedAt).toISOString(),
      seconds: r.seconds,
      // Com GPS ou natação (piscinas × tamanho da piscina); sem GPS a distância não é medida.
      ...(r.distanceM >= 10 ? { distance_m: Math.round(r.distanceM) } : {}),
      ...(sport!.gps && r.track ? { elevation_gain_m: Math.round(r.elevationGainM) } : {}),
      ...(r.poolLengthM ? { pool_length_m: r.poolLengthM } : {}),
      ...(r.poolLengths ? { pool_lengths: r.poolLengths } : {}),
      ...(r.title ? { title: r.title } : {}),
      ...(r.feeling ? { feeling: r.feeling } : {}),
      ...(r.effort ? { effort: r.effort } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
      ...(r.tag ? { tag: r.tag } : {}),
      ...(r.sets ? { sets: r.sets } : {}),
      idempotency_key: recordingKey(`livre.${sport!.id}`, r.startedAt),
      ...(r.track ? { recording: { track: r.track } } : {}),
    };
    // De quem é a atividade: fixado antes de enviar. Trocar de conta no meio não manda para a fila da outra.
    const who = fitnessOwner();
    if (!who) throw new Error('sem conta ativa');
    try {
      await record.mutateAsync(body);
      return 'saved';
    } catch (e) {
      // Recusado pelo servidor (4xx) não adianta guardar: a tela avisa e a pessoa tenta de novo.
      const status = isAxiosError(e) ? (e.response?.status ?? 0) : 0;
      if (status >= 400 && status < 500) throw e;
      await queueActivity(body, who);
      return 'queued';
    }
  }

  return (
    <Recorder
      // Trocar de esporte monta uma gravação nova (GPS, piscina e ajustes de cada esporte).
      key={sport.id}
      sport={sport}
      heading={sport.label}
      subtitle={i18n.t('fitness:freeWorkout')}
      askTitle
      askTag
      onPickSport={(next) => router.replace(`/cliente/treinar/${next}`)}
      draftKey={`livre:${sport.id}`}
      resumeRoute={`/cliente/treinar/${sport.id}`}
      onSave={save}
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/(client)/fitness'))}
      onHistory={() => router.replace('/cliente/historico')}
    />
  );
}
