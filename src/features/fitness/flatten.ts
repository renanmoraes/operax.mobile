import type { FitnessCombinedItem, FitnessExerciseItem, FitnessExerciseSnapshot, FitnessWorkoutView } from './types';

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
  exerciseId: string;
  name: string;
  snapshot?: FitnessExerciseSnapshot;
  /** Séries na ordem de execução. `rest`: descanso depois desta série (0 = segue direto, como entre estágios de um drop set). */
  sets: { reps: number; kg: number; rest?: number }[];
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
        rows.push(fromExercise(w, item, `${pi}:${ii}`));
        return;
      }
      const first = item.items[0];
      const snap = w.exercise_snapshots.find((s) => s.id === first.exercise_id);
      const loads = item.items.map((x) => parseKg(x.sets[0]?.load));
      const reps = parseInt(first.sets[0]?.reps ?? '0', 10) || 0;
      const loadLabel = `${fmt(Math.max(...loads))} → ${fmt(Math.min(...loads))} kg`;
      // Cada rodada tem todos os estágios do bloco (carga e repetições de cada um);
      // entre estágios não há descanso, só ao fim da rodada.
      const stages = item.items.map((x) => ({ kg: parseKg(x.sets[0]?.load), reps: parseInt(x.sets[0]?.reps ?? '0', 10) || 0 }));
      const sets = Array.from({ length: item.rounds }, () =>
        stages.map((st, si) => ({ ...st, rest: si === stages.length - 1 ? item.rest_seconds : 0 })),
      ).flat();
      rows.push({
        key: `${pi}:${ii}`,
        exerciseId: first.exercise_id,
        name: snap?.name ?? first.exercise_id,
        snapshot: snap,
        sets,
        restSeconds: item.rest_seconds,
        kg: loads[0],
        reps,
        prescription: `${item.rounds} séries · ${item.items.length} cargas`,
        loadLabel,
        tag: BLOCK_LABEL[item.block_kind],
      });
    });
  });
  return rows;
}

function fromExercise(w: FitnessWorkoutView, item: FitnessExerciseItem, key: string): ExerciseRow {
  const snap = w.exercise_snapshots.find((s) => s.id === item.exercise_id);
  const sets = item.sets.map((s) => ({ reps: parseInt(s.reps, 10) || 0, kg: parseKg(s.load) }));
  const first = sets[0] ?? { reps: 0, kg: 0 };
  return {
    key,
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

export function totalSets(rows: ExerciseRow[]) {
  return rows.reduce((n, r) => n + r.sets.length, 0);
}

/** Estimativa de duração: 45 s por série + descanso. */
export function estimateMinutes(rows: ExerciseRow[]) {
  return Math.round(rows.reduce((n, r) => n + r.sets.length * (45 + r.restSeconds), 0) / 60);
}
