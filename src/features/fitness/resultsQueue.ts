import { getItem, setItem } from '@/src/shared/storage';
import { fitnessOwner, ownedKey } from './owner';
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

/*
 * Leitura e escrita da fila sempre em série (uma de cada vez) e por conta (ver `owner.ts`): um envio em
 * andamento não apaga o resultado que outra tela guardou nesse meio-tempo, e a fila de uma pessoa nunca
 * sai com o login de outra.
 */
let lock: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

async function read<T>(base: string): Promise<T[]> {
  const key = ownedKey(base);
  if (!key) return [];
  try {
    return JSON.parse((await getItem(key)) ?? '[]') as T[];
  } catch {
    return [];
  }
}

async function write<T>(base: string, queue: T[]) {
  const key = ownedKey(base);
  if (key) await setItem(key, JSON.stringify(queue));
}

export const loadQueue = () => read<RecordResultBody>(KEY);
export const loadActivityQueue = () => read<FreeActivityBody>(ACTIVITIES_KEY);

/** Guarda resultados para enviar depois (sem duplicar pela chave). */
export function queueResults(bodies: RecordResultBody[]) {
  return serial(async () => write(KEY, bodies.reduce(enqueue, await read<RecordResultBody>(KEY))));
}

export function queueActivity(body: FreeActivityBody) {
  return serial(async () => write(ACTIVITIES_KEY, enqueue(await read<FreeActivityBody>(ACTIVITIES_KEY), body)));
}

/** Tira da fila só o que já foi resolvido (enviado ou recusado), relendo a fila atual: o que entrou durante o envio fica. */
function settle(base: string, done: Set<string>) {
  return serial(async () => write(base, (await read<Keyed>(base)).filter((b) => !done.has(b.idempotency_key))));
}

let flushing = false;
/** Reenvia as duas filas (resultados da ficha e treinos livres). Devolve se algo saiu. */
export async function flushAll(senders: { result: QueueSender<RecordResultBody>; activity: QueueSender<FreeActivityBody> }): Promise<boolean> {
  if (flushing || !fitnessOwner()) return false;
  flushing = true;
  try {
    let changed = false;
    for (const [base, send] of [[KEY, senders.result], [ACTIVITIES_KEY, senders.activity]] as const) {
      const queue = await read<Keyed>(base);
      if (!queue.length) continue;
      const rest = await flushQueue(queue, send as QueueSender<Keyed>);
      const left = new Set(rest.map((b) => b.idempotency_key));
      const done = new Set(queue.map((b) => b.idempotency_key).filter((k) => !left.has(k)));
      if (done.size) {
        await settle(base, done);
        changed = true;
      }
    }
    return changed;
  } finally {
    flushing = false;
  }
}

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
