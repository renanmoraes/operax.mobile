import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { isAxiosError } from 'axios';
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

/**
 * O servidor recusou de vez (4xx: dado inválido, sem acesso). Guardar na fila não adianta (ela descartaria
 * depois, em silêncio): quem chama avisa a pessoa e mantém o que ela digitou para corrigir.
 */
export function isRejected(e: unknown): boolean {
  const status = isAxiosError(e) ? (e.response?.status ?? 0) : 0;
  return status >= 400 && status < 500;
}

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

// No banco local do aparelho (sem o limite de ~2 KB por valor do armazenamento seguro): uma fila com
// vários treinos de musculação passa disso fácil.
async function read<T>(base: string, who?: string): Promise<T[]> {
  const key = ownedKey(base, who);
  if (!key) return [];
  return (await kvGet<T[]>(key)) ?? [];
}

async function write<T>(base: string, queue: T[], who?: string) {
  const key = ownedKey(base, who);
  if (key) await kvSet(key, queue);
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

/** Tira da fila do dono só o que já foi resolvido (enviado ou recusado), relendo a fila atual: o que entrou durante o envio fica. */
function settle(base: string, done: Set<string>, who: string) {
  return serial(async () => write(base, (await read<Keyed>(base, who)).filter((b) => !done.has(b.idempotency_key)), who));
}

let flushing = false;
/** Reenvia as duas filas (resultados da ficha e treinos livres). Devolve se algo saiu. */
export async function flushAll(senders: { result: QueueSender<RecordResultBody>; activity: QueueSender<FreeActivityBody> }): Promise<boolean> {
  // O envio fica preso à conta que começou: se a pessoa trocar de conta no meio, para antes do próximo
  // item (o login já é outro) e só mexe na fila de quem começou.
  const who = fitnessOwner();
  if (flushing || !who) return false;
  flushing = true;
  try {
    let changed = false;
    for (const [base, send] of [[KEY, senders.result], [ACTIVITIES_KEY, senders.activity]] as const) {
      if (fitnessOwner() !== who) break;
      const queue = await read<Keyed>(base, who);
      if (!queue.length) continue;
      const guarded: QueueSender<Keyed> = (b) => (fitnessOwner() === who ? (send as QueueSender<Keyed>)(b) : Promise.resolve({ ok: false, status: 0 }));
      const rest = await flushQueue(queue, guarded);
      const left = new Set(rest.map((b) => b.idempotency_key));
      const done = new Set(queue.map((b) => b.idempotency_key).filter((k) => !left.has(k)));
      if (done.size) {
        await settle(base, done, who);
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
