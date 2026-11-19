import { isoDate } from '@/src/shared/format';
import { fetchWorkoutsRaw } from './fitnessApi';
import { datesToFetch, doneKey, enforceLimits, isNetworkFailure, keepIds, prune, putDay, readStore, updateStore } from './offlineStore';
import { fitnessOwner } from './owner';
import { pendingDone } from './resultsQueue';

/** Não baixa de novo antes disso (a fila reenvia a cada minuto; o download não precisa). */
const MIN_GAP_MS = 30 * 60_000;
let running = false;

/**
 * Baixa os treinos dos próximos dias para usar sem internet, dentro do limite (ver `offlineStore.ts`).
 * Pula o que já foi feito (enviado ou ainda na fila) e limpa o que ficou velho. Sem internet, para quieto
 * e mantém o que já estava guardado. `force`: ignora o intervalo mínimo.
 */
export async function syncOfflineWorkouts(opts: { force?: boolean } = {}): Promise<boolean> {
  const who = fitnessOwner();
  if (!who || running) return false;
  running = true;
  try {
    const cur = await readStore(who);
    if (!opts.force && cur.syncedAt && Date.now() - cur.syncedAt < MIN_GAP_MS) return false;
    const today = isoDate(new Date());
    const queued = await pendingDone();
    const fetched: [string, Awaited<ReturnType<typeof fetchWorkoutsRaw>>][] = [];
    let complete = true;
    try {
      for (const date of datesToFetch(today)) {
        if (fitnessOwner() !== who) return false;
        fetched.push([date, await fetchWorkoutsRaw(date)]);
      }
    } catch (e) {
      // Erro do servidor: não mexe no que está guardado. Sem internet no meio: guarda o que já veio e tenta o resto depois.
      if (!isNetworkFailure(e) || !fetched.length) return false;
      complete = false;
    }
    if (fitnessOwner() !== who) return false;
    const keep = await keepIds();
    await updateStore((s) => {
      let next = { ...s, done: [...new Set([...s.done, ...queued])] };
      for (const [date, ws] of fetched) next = putDay(next, date, ws.filter((w) => !next.done.includes(doneKey(w.id, date))));
      return { ...enforceLimits(prune(next, today, keep)), syncedAt: complete ? Date.now() : s.syncedAt };
    }, who);
    return true;
  } finally {
    running = false;
  }
}
