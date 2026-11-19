import { isAxiosError } from 'axios';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { addDays, isoDate, startOfDay, startOfWeek } from '@/src/shared/format';
import { fitnessOwner, ownedKey } from './owner';
import { pendingWorkoutIds } from './resultsQueue';
import { loadFinishedSession } from './sessionStore';
import type { FitnessWorkoutView, WeekView } from './types';

/**
 * Treinos do cliente guardados no celular para usar sem internet.
 *
 * Limite adotado (o celular nunca guarda mais que isto de treinos baixados):
 *  - até `HORIZON_DAYS` dias à frente (14: cobre uma viagem de duas semanas);
 *  - até `MAX_WORKOUTS` fichas (40) e `MAX_BYTES` de JSON (3 MB). Passou, sai primeiro o dia mais distante.
 * Só o texto da ficha é baixado; vídeos e fotos dos exercícios continuam pela internet (são pesados).
 * Nada aqui toca na fila de resultados: o que foi feito sem internet e ainda não subiu nunca é apagado.
 */
export const HORIZON_DAYS = 14;
export const MAX_WORKOUTS = 40;
export const MAX_BYTES = 3_000_000;
/** Marcas de "feito e enviado" guardadas por este tempo (evita baixar de novo um treino já feito). */
const DONE_KEEP_DAYS = 45;

export type OfflineStore = {
  /** Dia (AAAA-MM-DD) → ids das fichas daquele dia. */
  days: Record<string, string[]>;
  workouts: Record<string, FitnessWorkoutView>;
  /** `idFicha:dia` de treinos já feitos e confirmados no servidor. */
  done: string[];
  /** Última semana vista online (para a aba Treino abrir sem internet). */
  week: WeekView | null;
  syncedAt: number | null;
};

export const emptyStore = (): OfflineStore => ({ days: {}, workouts: {}, done: [], week: null, syncedAt: null });
export const doneKey = (workoutId: string, date: string) => `${workoutId}:${date}`;

/** Sem resposta do servidor (sem internet, tempo esgotado): é o caso em que vale usar o que está guardado. */
export function isNetworkFailure(e: unknown): boolean {
  return isAxiosError(e) && !e.response;
}

const sizeOf = (s: OfflineStore) => JSON.stringify({ days: s.days, workouts: s.workouts }).length;

/** Tira as fichas sem dia e sobra só o que cabe no limite, do dia mais distante para o mais próximo. */
export function enforceLimits(store: OfflineStore, limits = { workouts: MAX_WORKOUTS, bytes: MAX_BYTES }): OfflineStore {
  const days = { ...store.days };
  const used = () => new Set(Object.values(days).flat());
  const compact = (): OfflineStore => {
    const keep = used();
    return { ...store, days, workouts: Object.fromEntries(Object.entries(store.workouts).filter(([id]) => keep.has(id))) };
  };
  let out = compact();
  while (Object.keys(days).length && (Object.keys(out.workouts).length > limits.workouts || sizeOf(out) > limits.bytes)) {
    const farthest = Object.keys(days).sort().pop()!;
    delete days[farthest];
    out = compact();
  }
  return out;
}

/** Guarda as fichas de um dia baixadas do servidor, sem as que já foram feitas e confirmadas. */
export function putDay(store: OfflineStore, date: string, workouts: FitnessWorkoutView[]): OfflineStore {
  const fresh = workouts.filter((w) => !store.done.includes(doneKey(w.id, date)));
  const next: OfflineStore = {
    ...store,
    days: { ...store.days },
    workouts: { ...store.workouts, ...Object.fromEntries(fresh.map((w) => [w.id, w])) },
  };
  if (fresh.length) next.days[date] = fresh.map((w) => w.id);
  else delete next.days[date];
  return next;
}

/**
 * Limpeza: some o que já foi feito e confirmado, e os dias que já passaram. `keepIds` (fichas com resultado
 * esperando envio ou treino terminado ainda na tela) nunca saem. Uma ficha só sai quando nenhum dia a usa.
 */
export function prune(store: OfflineStore, today: string, keepIds: Set<string> = new Set()): OfflineStore {
  const doneSet = new Set(store.done);
  const days: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(store.days)) {
    const left = ids.filter((id) => !doneSet.has(doneKey(id, date)) && (date >= today || keepIds.has(id)));
    if (left.length) days[date] = left;
  }
  const referenced = new Set([...Object.values(days).flat(), ...keepIds]);
  const cutoff = isoDate(addDays(new Date(`${today}T12:00:00`), -DONE_KEEP_DAYS));
  return {
    ...store,
    days,
    workouts: Object.fromEntries(Object.entries(store.workouts).filter(([id]) => referenced.has(id))),
    done: store.done.filter((k) => k.slice(k.lastIndexOf(':') + 1) >= cutoff),
  };
}

export function markDone(store: OfflineStore, workoutId: string, date: string): OfflineStore {
  const key = doneKey(workoutId, date);
  return store.done.includes(key) ? store : { ...store, done: [...store.done, key] };
}

/** Datas ainda por baixar: de hoje até o horizonte. */
export function datesToFetch(today: string, horizon = HORIZON_DAYS): string[] {
  const start = new Date(`${today}T12:00:00`);
  return Array.from({ length: horizon + 1 }, (_, i) => isoDate(addDays(start, i)));
}

/** Semana montada só com o que está guardado (quando não há uma semana vista online que cubra hoje). */
export function weekFromStore(store: OfflineStore, today: string): WeekView {
  const start = startOfWeek(startOfDay(new Date(`${today}T12:00:00`)));
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = isoDate(addDays(start, i));
    const items = (store.days[iso] ?? []).map((id) => store.workouts[id]).filter(Boolean).map((w) => ({ id: w.id, title: w.title, modality: w.modality, parts: w.parts }));
    return { date: iso, planned: items.length, done: 0, extra: 0, items };
  });
  const nextDate = Object.keys(store.days).filter((d) => d >= today).sort()[0];
  const nextWorkout = nextDate ? store.workouts[store.days[nextDate][0]] : undefined;
  return {
    start: days[0].date,
    today,
    days,
    summary: { planned: days.reduce((n, d) => n + d.planned, 0), done: 0, extra: 0, distance_meters: 0, duration_seconds: 0 },
    done: [],
    next: nextDate && nextWorkout ? { date: nextDate, workout: nextWorkout } : null,
  };
}

// ---------- persistência (por conta, no banco local) ----------

const KEY = 'operax_offline_fitness';
const storeKey = (who = fitnessOwner()) => ownedKey(KEY, who);

let lock: Promise<unknown> = Promise.resolve();
/** Leitura e escrita em série: duas atualizações ao mesmo tempo não se atropelam. */
export function updateStore(fn: (s: OfflineStore) => OfflineStore | Promise<OfflineStore>, who = fitnessOwner()): Promise<OfflineStore> {
  const run = lock.then(async () => {
    const key = storeKey(who);
    if (!key) return emptyStore();
    const cur = { ...emptyStore(), ...((await kvGet<OfflineStore>(key)) ?? {}) };
    const next = await fn(cur);
    if (next !== cur) await kvSet(key, next);
    return next;
  });
  lock = run.catch(() => undefined);
  return run;
}

export async function readStore(who = fitnessOwner()): Promise<OfflineStore> {
  const key = storeKey(who);
  return key ? { ...emptyStore(), ...((await kvGet<OfflineStore>(key)) ?? {}) } : emptyStore();
}

/** Registra que o treino foi feito e confirmado no servidor e tira da lista de baixados o que já passou. */
export function confirmDone(workoutId: string, date: string, keepIds: () => Promise<Set<string>>) {
  return updateStore(async (s) => prune(markDone(s, workoutId, date), isoDate(new Date()), await keepIds()));
}

/**
 * Leitura com reserva no celular: online devolve a resposta e guarda uma cópia; sem internet devolve a
 * última cópia (se não houver, o erro segue). Erro do servidor (4xx/5xx) nunca cai na cópia.
 */
export async function withCache<T>(name: string, load: () => Promise<T>): Promise<T> {
  const who = fitnessOwner();
  const key = ownedKey(`operax_offline_cache_${name}`, who);
  try {
    const data = await load();
    if (key) void kvSet(key, data);
    return data;
  } catch (e) {
    if (isNetworkFailure(e) && key) {
      const saved = await kvGet<T>(key);
      if (saved != null && fitnessOwner() === who) return saved;
    }
    throw e;
  }
}

/** Fichas que a limpeza não pode apagar: com resultado esperando envio ou treino terminado ainda na tela. */
export async function keepIds(): Promise<Set<string>> {
  const ids = await pendingWorkoutIds();
  const fin = await loadFinishedSession();
  if (fin) ids.add(fin.workoutId);
  return ids;
}
