import type { FitnessCombinedItem, FitnessExerciseItem, FitnessExerciseSnapshot, FitnessWorkoutView, RecordResultBody } from './types';

export function parseKg(load: string | undefined): number {
  if (!load) return 0;
  const n = parseFloat(load.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const BLOCK_LABEL: Record<FitnessCombinedItem['block_kind'], string> = {
  superset: 'Superset',
  biset: 'Bi-set',
  triset: 'Tri-set',
  circuit: 'Circuito',
  dropset: 'Drop set',
  rest_pause: 'Rest-pause',
  pyramid: 'Pirâmide',
  cluster: 'Cluster',
  giant_set: 'Série gigante',
};

export type ExerciseRow = {
  key: string;
  /** Onde a linha está no treino: parte e item dentro da parte (é o que o resultado salvo precisa). */
  partIndex: number;
  itemIndex: number;
  exerciseId: string;
  name: string;
  snapshot?: FitnessExerciseSnapshot;
  /**
   * Séries na ordem de execução. `rest`: descanso depois desta série (0 = segue direto, como entre estágios de um drop set).
   * Em bloco com exercícios diferentes (superset, circuito…), cada estágio diz o seu exercício.
   */
  sets: { reps: number; kg: number; rest?: number; exerciseId?: string; name?: string; snapshot?: FitnessExerciseSnapshot }[];
  restSeconds: number;
  kg: number;
  reps: number;
  prescription: string;
  loadLabel: string;
  tag?: string;
  notes?: string;
};

const fmt = (kg: number) => String(kg).replace('.', ',');

/** Abre a parte de força em uma linha por exercício; blocos combinados viram uma linha com o rótulo do bloco. */
export function flattenWorkout(w: FitnessWorkoutView): ExerciseRow[] {
  const rows: ExerciseRow[] = [];
  w.parts.forEach((part, pi) => {
    if (part.type !== 'strength') return;
    part.items.forEach((item, ii) => {
      if (item.kind === 'exercise') {
        rows.push(fromExercise(w, item, pi, ii));
        return;
      }
      const first = item.items[0];
      const snap = w.exercise_snapshots.find((s) => s.id === first.exercise_id);
      const snapOf = (id: string) => w.exercise_snapshots.find((s) => s.id === id);
      const distinct = [...new Set(item.items.map((x) => x.exercise_id))];
      const loads = item.items.map((x) => parseKg(x.sets[0]?.load));
      const reps = parseInt(first.sets[0]?.reps ?? '0', 10) || 0;
      const loadLabel = `${fmt(Math.max(...loads))} → ${fmt(Math.min(...loads))} kg`;
      // Cada rodada tem todos os estágios do bloco (carga e repetições de cada um);
      // entre estágios não há descanso, só ao fim da rodada.
      const stages = item.items.map((x) => ({
        kg: parseKg(x.sets[0]?.load),
        reps: parseInt(x.sets[0]?.reps ?? '0', 10) || 0,
        exerciseId: x.exercise_id,
        name: snapOf(x.exercise_id)?.name ?? x.exercise_id,
        snapshot: snapOf(x.exercise_id),
      }));
      const sets = Array.from({ length: item.rounds }, () =>
        stages.map((st, si) => ({ ...st, rest: si === stages.length - 1 ? item.rest_seconds : 0 })),
      ).flat();
      rows.push({
        key: `${pi}:${ii}`,
        partIndex: pi,
        itemIndex: ii,
        exerciseId: first.exercise_id,
        // Drop set é o mesmo exercício; superset/circuito mostra todos ("Supino + Remada").
        name: distinct.length > 1 ? distinct.map((id) => snapOf(id)?.name ?? id).join(' + ') : snap?.name ?? first.exercise_id,
        snapshot: snap,
        sets,
        restSeconds: item.rest_seconds,
        kg: loads[0],
        reps,
        prescription: distinct.length > 1 ? `${item.rounds} rodadas · ${item.items.length} exercícios` : `${item.rounds} séries · ${item.items.length} cargas`,
        loadLabel,
        tag: BLOCK_LABEL[item.block_kind],
      });
    });
  });
  return rows;
}

function fromExercise(w: FitnessWorkoutView, item: FitnessExerciseItem, partIndex: number, itemIndex: number): ExerciseRow {
  const snap = w.exercise_snapshots.find((s) => s.id === item.exercise_id);
  // Cada série com o próprio descanso: 30 s depois da primeira e 90 s depois da segunda valem como prescrito.
  const sets = item.sets.map((s) => ({ reps: parseInt(s.reps, 10) || 0, kg: parseKg(s.load), ...(s.rest_seconds != null ? { rest: s.rest_seconds } : {}) }));
  const first = sets[0] ?? { reps: 0, kg: 0 };
  return {
    key: `${partIndex}:${itemIndex}`,
    partIndex,
    itemIndex,
    exerciseId: item.exercise_id,
    name: snap?.name ?? item.exercise_id,
    snapshot: snap,
    sets,
    restSeconds: item.sets[0]?.rest_seconds ?? 60,
    kg: first.kg,
    reps: first.reps,
    prescription: `${sets.length} × ${first.reps} · ${fmt(first.kg)} kg`,
    loadLabel: `${fmt(first.kg)} kg`,
    tag: item.notes?.startsWith('Progressão') ? item.notes : item.notes?.startsWith('Vídeo') ? item.notes : undefined,
    notes: item.notes,
  };
}

/** Carga e repetições da próxima série ainda não feita (drop set: o estágio seguinte, não o primeiro). */
export function nextPrescription(row: Pick<ExerciseRow, 'kg' | 'reps' | 'sets'>, doneCount: number): { kg: number; reps: number } {
  const s = row.sets[Math.min(doneCount, row.sets.length - 1)];
  return s ? { kg: s.kg, reps: s.reps } : { kg: row.kg, reps: row.reps };
}

/**
 * Um resultado por parte de força feita, com o item de cada série na posição dele dentro da parte.
 * A chave de envio é fixa por treino terminado + parte: tentar de novo nunca grava duas vezes.
 * Sensação, esforço e comentário vão só no primeiro (são do treino, não de cada parte).
 */
export function buildResultBodies(
  rows: Pick<ExerciseRow, 'partIndex' | 'itemIndex'>[],
  logs: { kg: number; reps: number }[][],
  base: { workout_id: string; executed_on: string; idempotency_key: string; notes?: string; effort?: number; feeling?: RecordResultBody['feeling'] },
): RecordResultBody[] {
  const byPart = new Map<number, { item: number; set: number; done: true; load_kg: number; reps: number }[]>();
  rows.forEach((r, i) => {
    const done = logs[i] ?? [];
    if (!done.length) return;
    const list = byPart.get(r.partIndex) ?? [];
    done.forEach((s, set) => list.push({ item: r.itemIndex, set, done: true, load_kg: s.kg, reps: s.reps }));
    byPart.set(r.partIndex, list);
  });
  const { notes, effort, feeling, idempotency_key, ...common } = base;
  return [...byPart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([part_index, sets], n) => ({
      ...common,
      part_index,
      data: { kind: 'sets' as const, sets },
      idempotency_key: `${idempotency_key.slice(0, 72)}-p${part_index}`,
      ...(n === 0 ? { notes, effort, feeling } : {}),
    }));
}

export function totalSets(rows: ExerciseRow[]) {
  return rows.reduce((n, r) => n + r.sets.length, 0);
}

/** Estimativa de duração: 45 s por série + descanso. */
export function estimateMinutes(rows: ExerciseRow[]) {
  return Math.round(rows.reduce((n, r) => n + r.sets.length * (45 + r.restSeconds), 0) / 60);
}
