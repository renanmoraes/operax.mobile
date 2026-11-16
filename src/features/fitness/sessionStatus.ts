import type { ExerciseRow } from './flatten';
import type { SetLog } from './sessionStore';

export type ExerciseStatus = 'pending' | 'active' | 'done' | 'incomplete';

/** Status de um exercício a partir das séries já logadas — nunca guardado, sempre recalculado de `logs`. */
export function exerciseStatus(row: Pick<ExerciseRow, 'sets'>, done: SetLog[], isActive: boolean): ExerciseStatus {
  if (isActive) return 'active';
  if (done.length >= row.sets.length) return 'done';
  if (done.length > 0) return 'incomplete';
  return 'pending';
}

/**
 * Próximo índice sem todas as séries feitas, procurando só pra frente a partir de `from` (exclusive).
 * -1 se não sobrar nenhum. Nunca dá a volta pros de trás de `from` — ver spec, seção "Navegação sequencial".
 */
export function nextOpenIndex(rows: Pick<ExerciseRow, 'sets'>[], logs: SetLog[][], from: number): number {
  for (let i = from + 1; i < rows.length; i++) {
    if ((logs[i]?.length ?? 0) < rows[i].sets.length) return i;
  }
  return -1;
}

export type TransitionRest = { kind: 'ring'; seconds: number } | { kind: 'stopwatch' };

/**
 * Descanso de transição pro próximo exercício, a partir do último set do exercício que acabou de terminar.
 * Usa `sets[last].rest` (só existe quando a API manda `rest_seconds` naquele set) — nunca `row.restSeconds`,
 * que tem um padrão de 60s embutido em `flatten.ts` e por isso nunca reflete "sem descanso programado".
 */
export function transitionRest(finishedRow: Pick<ExerciseRow, 'sets'>): TransitionRest {
  const rest = finishedRow.sets[finishedRow.sets.length - 1]?.rest;
  return rest && rest > 0 ? { kind: 'ring', seconds: rest } : { kind: 'stopwatch' };
}
