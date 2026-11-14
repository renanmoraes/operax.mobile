import { getItem, setItem } from '@/src/shared/storage';
import type { FreeActivityBody, RecordResultBody } from './types';

/**
 * Fila offline de resultados, igual à do portal (lib/offline-results.ts): sem rede (status 0)
 * ou 5xx para e guarda o resto; 4xx descarta (o servidor já tem ou recusou); reenvio usa a
 * mesma idempotency_key, então nunca duplica.
 */

type Keyed = { idempotency_key: string };
export type QueueSender<T extends Keyed = RecordResultBody> = (body: T) => Promise<{ ok: true } | { ok: false; status: number }>;

const KEY = 'operax_fitness_results_queue';
/** Treinos livres gravados sem internet (mesmas regras da fila de resultados). */
const ACTIVITIES_KEY = 'operax_fitness_activities_queue';

export function enqueue<T extends Keyed>(queue: T[], body: T): T[] {
  return queue.some((b) => b.idempotency_key === body.idempotency_key) ? queue : [...queue, body];
}

export async function flushQueue<T extends Keyed>(queue: T[], send: QueueSender<T>): Promise<T[]> {
  const rest = [...queue];
  while (rest.length) {
    const res = await send(rest[0]);
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      rest.shift();
      continue;
    }
    break;
  }
  return rest;
}

export async function loadQueue(): Promise<RecordResultBody[]> {
  try {
    return JSON.parse((await getItem(KEY)) ?? '[]') as RecordResultBody[];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: RecordResultBody[]) {
  await setItem(KEY, JSON.stringify(queue));
}

export async function loadActivityQueue(): Promise<FreeActivityBody[]> {
  try {
    return JSON.parse((await getItem(ACTIVITIES_KEY)) ?? '[]') as FreeActivityBody[];
  } catch {
    return [];
  }
}

export async function saveActivityQueue(queue: FreeActivityBody[]) {
  await setItem(ACTIVITIES_KEY, JSON.stringify(queue));
}

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
