import { getItem, setItem } from '@/src/shared/storage';
import type { RecordResultBody } from './types';

/**
 * Fila offline de resultados, igual à do portal (lib/offline-results.ts): sem rede (status 0)
 * ou 5xx para e guarda o resto; 4xx descarta (o servidor já tem ou recusou); reenvio usa a
 * mesma idempotency_key, então nunca duplica.
 */

export type QueueSender = (body: RecordResultBody) => Promise<{ ok: true } | { ok: false; status: number }>;

const KEY = 'operax_fitness_results_queue';

export function enqueue(queue: RecordResultBody[], body: RecordResultBody): RecordResultBody[] {
  return queue.some((b) => b.idempotency_key === body.idempotency_key) ? queue : [...queue, body];
}

export async function flushQueue(queue: RecordResultBody[], send: QueueSender): Promise<RecordResultBody[]> {
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

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
