import { getItem, setItem, deleteItem } from '@/src/shared/storage';
import { isoDate } from '@/src/shared/format';
import { ownedKey } from './owner';

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

/** Por conta: o rascunho de um aluno nunca aparece para outro que entrar no mesmo celular (treino coletivo). */
const draftKey = (workoutId: string) => ownedKey(`operax_workout_draft_${workoutId}_${isoDate(new Date())}`);

/** Rascunho do treino do dia no aparelho (como o portal): fechar o app não perde as séries. */
export async function loadDraft(workoutId: string): Promise<SessionDraft | null> {
  const key = draftKey(workoutId);
  if (!key) return null;
  try {
    const raw = await getItem(key);
    return raw ? (JSON.parse(raw) as SessionDraft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(d: SessionDraft) {
  const key = draftKey(d.workoutId);
  if (key) await setItem(key, JSON.stringify(d));
}

export async function clearDraft(workoutId: string) {
  const key = draftKey(workoutId);
  if (key) await deleteItem(key);
}

const finishedKey = () => ownedKey('operax_workout_finished');
let finished: FinishedSession | null = null;

/** Treino terminado e ainda não salvo: fica gravado no aparelho até o resultado ser salvo ou ir para a fila. */
export function setFinishedSession(s: FinishedSession) {
  finished = s;
  const key = finishedKey();
  if (key) void setItem(key, JSON.stringify(s));
}

export function getFinishedSession() {
  return finished;
}

/** Troca de conta: esquece o treino terminado que estava em memória (o do aparelho já é por conta). */
export function resetFinishedSessionMemory() {
  finished = null;
}

/** Recupera o treino terminado se o app foi fechado na tela de conclusão. */
export async function loadFinishedSession(): Promise<FinishedSession | null> {
  if (finished) return finished;
  const key = finishedKey();
  if (!key) return null;
  try {
    const raw = await getItem(key);
    finished = raw ? (JSON.parse(raw) as FinishedSession) : null;
  } catch {
    finished = null;
  }
  return finished;
}

/** Depois de salvar (ou guardar na fila): apaga o treino terminado e o rascunho do dia. */
export async function clearFinishedSession(workoutId: string) {
  finished = null;
  const key = finishedKey();
  if (key) await deleteItem(key);
  await clearDraft(workoutId);
}
