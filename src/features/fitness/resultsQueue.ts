import { kvGet, kvSetDurable } from '@/src/shared/db/localDb';
import { isAxiosError } from 'axios';
import { fitnessOwner, ownedKey } from './owner';
import type { FreeActivityBody, RecordResultBody } from './types';

/**
 * Fila offline de resultados, igual à do portal (lib/offline-results.ts): sem rede (status 0)
 * ou 5xx para e guarda o resto; 4xx descarta (o servidor já tem ou recusou); reenvio usa a
 * mesma idempotency_key, então nunca duplica.
 */

type Keyed = { idempotency_key: string };
/** `retryAfterMs`: o servidor pediu para esperar (`Retry-After`) antes de tentar de novo. */
export type QueueSender<T extends Keyed = RecordResultBody> = (body: T) => Promise<{ ok: true } | { ok: false; status: number; retryAfterMs?: number }>;

/**
 * 4xx que é recusa de verdade (dado inválido, sem acesso, já existe). Não são: 401 (sessão a renovar),
 * 408 (demorou), 425 e 429 (muitas tentativas agora): esses ficam guardados e saem numa próxima vez.
 */
export function isPermanentRejection(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 408, 425, 429].includes(status);
}

const KEY = 'operax_fitness_results_queue';
/** Treinos livres gravados sem internet (mesmas regras da fila de resultados). */
const ACTIVITIES_KEY = 'operax_fitness_activities_queue';

/**
 * O servidor recusou de vez (4xx: dado inválido, sem acesso). Guardar na fila não adianta (ela descartaria
 * depois, em silêncio): quem chama avisa a pessoa e mantém o que ela digitou para corrigir.
 */
export function isRejected(e: unknown): boolean {
  return isPermanentRejection(isAxiosError(e) ? (e.response?.status ?? 0) : 0);
}

export function enqueue<T extends Keyed>(queue: T[], body: T): T[] {
  return queue.some((b) => b.idempotency_key === body.idempotency_key) ? queue : [...queue, body];
}

/** Até quando o servidor pediu para esperar (429 com `Retry-After`): antes disso a fila não reenvia. */
let waitUntil = 0;

export async function flushQueue<T extends Keyed>(queue: T[], send: QueueSender<T>): Promise<T[]> {
  const rest = [...queue];
  while (rest.length) {
    const res = await send(rest[0]);
    if (res.ok || isPermanentRejection(res.status)) {
      rest.shift();
      continue;
    }
    // Sem internet, 5xx ou "tente mais tarde": para aqui e guarda o resto (inclusive este) para a próxima vez.
    if (res.retryAfterMs && res.retryAfterMs > 0) waitUntil = Date.now() + Math.min(res.retryAfterMs, 15 * 60_000);
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

/** Lança se não conseguir guardar: quem chama mantém o treino na tela em vez de dizer que guardou. */
async function write<T>(base: string, queue: T[], who?: string) {
  const key = ownedKey(base, who);
  if (!key) throw new Error('Sem conta ativa para guardar o treino');
  await kvSetDurable(key, queue);
  listeners.forEach((l) => l());
}

/** Avisa (ex.: o aviso "pendente de envio") quando a fila muda. */
const listeners = new Set<() => void>();
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Quantos treinos (resultados da ficha + treinos livres) esperam internet para subir. */
export async function pendingCount(): Promise<number> {
  if (!fitnessOwner()) return 0;
  return (await read<Keyed>(KEY)).length + (await read<Keyed>(ACTIVITIES_KEY)).length;
}

/** Fichas com resultado esperando envio: a limpeza dos treinos baixados nunca as apaga. */
export async function pendingWorkoutIds(): Promise<Set<string>> {
  return new Set((await read<RecordResultBody>(KEY)).map((b) => b.workout_id));
}

/** Pares ficha+dia com resultado na fila: já foram feitos, então o download não os traz de novo. */
export async function pendingDone(): Promise<string[]> {
  return (await read<RecordResultBody>(KEY)).map((b) => `${b.workout_id}:${b.executed_on}`);
}

export const loadQueue = () => read<RecordResultBody>(KEY);
export const loadActivityQueue = () => read<FreeActivityBody>(ACTIVITIES_KEY);

/** Guarda resultados para enviar depois (sem duplicar pela chave). */
// A conta é fixada na hora do pedido: se ela mudar enquanto a fila é lida, a escrita continua na fila de
// quem pediu (nunca copia o treino de uma pessoa para a fila de outra).
/** `who`: de quem são os treinos (quem começou a salvar); por padrão o dono atual. */
export function queueResults(bodies: RecordResultBody[], who: string = fitnessOwner()) {
  return serial(async () => write(KEY, bodies.reduce(enqueue, await read<RecordResultBody>(KEY, who)), who));
}

/** `who`: de quem é a atividade (quem começou a salvar); por padrão o dono atual. */
export function queueActivity(body: FreeActivityBody, who: string = fitnessOwner()) {
  return serial(async () => write(ACTIVITIES_KEY, enqueue(await read<FreeActivityBody>(ACTIVITIES_KEY, who), body), who));
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
  if (flushing || !who || Date.now() < waitUntil) return false;
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

/**
 * Chave de envio de uma gravação, tirada do que o rascunho guarda (o que foi gravado e quando começou):
 * se o app fechar com o envio no ar e a gravação for retomada, salvar de novo usa a mesma chave e o
 * servidor reconhece o primeiro envio, sem criar outra atividade. Só `[A-Za-z0-9_:.-]`, até 80.
 */
export function recordingKey(scope: string, startedAt: number) {
  return `rec.${scope}.${Math.round(startedAt)}`.replace(/[^\w:.-]/g, '_').slice(0, 80);
}

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
