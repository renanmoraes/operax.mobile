import type { HealthWorkout } from './mapWorkouts';

/** Apps cujo treino gravado no aparelho não pode ir para o Operax (política da API do Strava). */
const BLOCKED_PACKAGES = ['com.strava'];
const blocked = (pkg: string) => BLOCKED_PACKAGES.some((b) => pkg === b || pkg.startsWith(`${b}.`));
/** O backend aceita até 100 por envio. */
export const HEALTH_BATCH = 100;
/** Quantos ids já enviados guardamos por conta: 30 dias de treinos cabem com folga. */
const SENT_MEMORY = 500;

export const healthKey = (w: Pick<HealthWorkout, 'source' | 'external_id'>) => `${w.source}:${w.external_id}`;

/** Os treinos lidos que ainda não foram para o Operax, sem os do Strava, em lotes do tamanho que o backend aceita. */
export function pendingBatches(workouts: HealthWorkout[], sent: readonly string[]): HealthWorkout[][] {
  const done = new Set(sent);
  const pending = workouts.filter((w) => !done.has(healthKey(w)) && !(w.origin_package && blocked(w.origin_package)));
  const batches: HealthWorkout[][] = [];
  for (let i = 0; i < pending.length; i += HEALTH_BATCH) batches.push(pending.slice(i, i + HEALTH_BATCH));
  return batches;
}

/** Junta os ids recém-enviados aos antigos, mantendo só os mais novos. */
export function rememberSent(sent: readonly string[], batch: HealthWorkout[]): string[] {
  const next = [...sent.filter((k) => !batch.some((w) => healthKey(w) === k)), ...batch.map(healthKey)];
  return next.slice(-SENT_MEMORY);
}
