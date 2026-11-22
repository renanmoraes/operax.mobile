import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { isoDate } from '@/src/shared/format';
import { fitnessOwner, ownedKey } from './owner';

export type SetLog = { kg: number; reps: number };

export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
  /** true depois que tocou "Iniciar exercício" para aquele índice; reseta pra false ao trocar de exercício. */
  started: boolean[];
  /** Por exercício; só conta depois do toque em "Iniciar exercício" (ver sessionStatus.ts / spec). */
  activeSeconds: number[];
  /** Por exercício: descanso entre séries + transição até o "Iniciar exercício". */
  restSeconds: number[];
};

/** Drafts salvos antes dos campos de tempo ativo/descanso não os têm — preenche com um padrão razoável. */
export function migrateDraft<T extends SessionDraft>(d: T): T {
  if (d.started && d.activeSeconds && d.restSeconds) return d;
  return {
    ...d,
    started: d.started ?? d.logs.map((l) => l.length > 0),
    activeSeconds: d.activeSeconds ?? d.logs.map(() => 0),
    restSeconds: d.restSeconds ?? d.logs.map(() => 0),
  };
}

/** `resultKey`: chave de envio deste treino terminado (a mesma em toda tentativa de salvar). */
export type FinishedSession = SessionDraft & { finishedAt: string; resultKey?: string };

/** Chave estável do treino terminado; instalações antigas sem `resultKey` usam treino + horário do fim. */
export const resultKeyOf = (s: Pick<FinishedSession, 'workoutId' | 'finishedAt' | 'resultKey'>) => s.resultKey ?? `${s.workoutId}-${s.finishedAt}`;

/** Por conta: o rascunho de um aluno nunca aparece para outro que entrar no mesmo celular (treino coletivo). */
const draftKey = (workoutId: string, who: string = fitnessOwner()) => ownedKey(`operax_workout_draft_${workoutId}_${isoDate(new Date())}`, who);

/** Rascunho do treino do dia no banco local do aparelho (como o portal): fechar o app não perde as séries. */
export async function loadDraft(workoutId: string): Promise<SessionDraft | null> {
  const who = fitnessOwner();
  const key = draftKey(workoutId);
  if (!key) return null;
  const draft = await kvGet<SessionDraft>(key);
  // Trocou de conta durante a leitura: o rascunho é de quem pediu, não da conta que entrou.
  return fitnessOwner() === who ? (draft ? migrateDraft(draft) : null) : null;
}

export async function saveDraft(d: SessionDraft) {
  const key = draftKey(d.workoutId);
  if (key) await kvSet(key, d);
}

export async function clearDraft(workoutId: string, who: string = fitnessOwner()) {
  const key = draftKey(workoutId, who);
  if (key) await kvSet(key, null);
}

const finishedKey = (who: string = fitnessOwner()) => ownedKey('operax_workout_finished', who);
/** Em memória junto com o dono: só volta para a mesma conta que terminou o treino. */
let finished: { who: string; session: FinishedSession } | null = null;
const mine = () => (finished && finished.who === fitnessOwner() ? finished.session : null);

/** Treino terminado e ainda não salvo: fica gravado no aparelho até o resultado ser salvo ou ir para a fila. */
export function setFinishedSession(s: FinishedSession) {
  const who = fitnessOwner();
  finished = { who, session: s };
  const key = finishedKey(who);
  if (key) void kvSet(key, s);
}

export function getFinishedSession() {
  return mine();
}

/** Troca de conta: esquece o treino terminado que estava em memória (o do aparelho já é por conta). */
export function resetFinishedSessionMemory() {
  finished = null;
}

/** Recupera o treino terminado se o app foi fechado na tela de conclusão. */
export async function loadFinishedSession(): Promise<FinishedSession | null> {
  const cached = mine();
  if (cached) return cached;
  // O dono é guardado antes da leitura: se a conta mudar no meio, o resultado é descartado.
  const who = fitnessOwner();
  const key = finishedKey(who);
  if (!key) return null;
  const session = await kvGet<FinishedSession>(key);
  if (fitnessOwner() !== who) return null;
  const migrated = session ? migrateDraft(session) : null;
  finished = migrated ? { who, session: migrated } : null;
  return migrated;
}

/**
 * Depois de salvar (ou guardar na fila): apaga o treino terminado e o rascunho do dia de `who` (quem
 * terminou o treino; por padrão o dono atual). Se a conta mudou no meio do salvamento, o da conta nova fica.
 */
export async function clearFinishedSession(workoutId: string, who: string = fitnessOwner()) {
  if (finished?.who === who) finished = null;
  const key = finishedKey(who);
  if (key) await kvSet(key, null);
  await clearDraft(workoutId, who);
}
