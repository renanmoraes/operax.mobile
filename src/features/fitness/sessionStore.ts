import { getItem, setItem, deleteItem } from '@/src/shared/storage';
import { isoDate } from '@/src/shared/format';

export type SetLog = { kg: number; reps: number };

export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
};

/** `resultKey`: chave de envio deste treino terminado (a mesma em toda tentativa de salvar). */
export type FinishedSession = SessionDraft & { finishedAt: string; resultKey?: string };

/** Chave estável do treino terminado; instalações antigas sem `resultKey` usam treino + horário do fim. */
export const resultKeyOf = (s: Pick<FinishedSession, 'workoutId' | 'finishedAt' | 'resultKey'>) => s.resultKey ?? `${s.workoutId}-${s.finishedAt}`;

const draftKey = (workoutId: string) => `operax_workout_draft_${workoutId}_${isoDate(new Date())}`;

/** Rascunho do treino do dia no aparelho (como o portal): fechar o app não perde as séries. */
export async function loadDraft(workoutId: string): Promise<SessionDraft | null> {
  try {
    const raw = await getItem(draftKey(workoutId));
    return raw ? (JSON.parse(raw) as SessionDraft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(d: SessionDraft) {
  await setItem(draftKey(d.workoutId), JSON.stringify(d));
}

export async function clearDraft(workoutId: string) {
  await deleteItem(draftKey(workoutId));
}

const FINISHED_KEY = 'operax_workout_finished';
let finished: FinishedSession | null = null;

/** Treino terminado e ainda não salvo: fica gravado no aparelho até o resultado ser salvo ou ir para a fila. */
export function setFinishedSession(s: FinishedSession) {
  finished = s;
  void setItem(FINISHED_KEY, JSON.stringify(s));
}

export function getFinishedSession() {
  return finished;
}

/** Recupera o treino terminado se o app foi fechado na tela de conclusão. */
export async function loadFinishedSession(): Promise<FinishedSession | null> {
  if (finished) return finished;
  try {
    const raw = await getItem(FINISHED_KEY);
    finished = raw ? (JSON.parse(raw) as FinishedSession) : null;
  } catch {
    finished = null;
  }
  return finished;
}

/** Depois de salvar (ou guardar na fila): apaga o treino terminado e o rascunho do dia. */
export async function clearFinishedSession(workoutId: string) {
  finished = null;
  await deleteItem(FINISHED_KEY);
  await clearDraft(workoutId);
}
