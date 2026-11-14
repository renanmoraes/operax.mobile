import { getItem, setItem, deleteItem } from '@/src/shared/storage';
import { isoDate } from '@/src/shared/format';

export type SetLog = { kg: number; reps: number };

export type SessionDraft = {
  workoutId: string;
  idx: number;
  logs: SetLog[][];
  elapsed: number;
};

export type FinishedSession = SessionDraft & { finishedAt: string };

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

let finished: FinishedSession | null = null;

export function setFinishedSession(s: FinishedSession) {
  finished = s;
}

export function getFinishedSession() {
  return finished;
}
