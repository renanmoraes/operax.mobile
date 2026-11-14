import type { EnduranceSport, FitnessEnduranceStep, FitnessExerciseSnapshot, FitnessPart, FitnessWorkoutView } from './types';

/**
 * Descrição em português de cada parte do treino, para qualquer modalidade (força, WOD, Hyrox,
 * corrida/bike/natação/remo, texto livre). A ficha e a aba Treino usam isto; a execução escolhe
 * a tela certa por parte (séries, gravação com GPS ou registro do resultado).
 */

export const SPORT_LABEL: Record<EnduranceSport | 'multi', string> = { run: 'Corrida', bike: 'Bike', swim: 'Natação', row: 'Remo', multi: 'Multiesporte' };

const METCON_LABEL: Record<string, string> = {
  amrap: 'AMRAP',
  emom: 'EMOM',
  for_time: 'For time',
  tabata: 'Tabata',
  chipper: 'Chipper',
  intervals: 'Intervalos',
  rounds: 'Rounds',
};

const STEP_LABEL: Record<FitnessEnduranceStep['kind'], string> = {
  warmup: 'Aquecimento',
  interval: 'Tiro',
  recovery: 'Recuperação',
  cooldown: 'Desaquecimento',
  rest: 'Descanso',
};

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}

const meters = (m: number) => (m >= 1000 ? `${String(Math.round(m / 100) / 10).replace('.', ',')} km` : `${m} m`);

function target(t: FitnessEnduranceStep['target']): string {
  if (!t) return '';
  const range = t.max != null ? `${t.min}–${t.max}` : `${t.min}`;
  switch (t.type) {
    case 'rpe':
      return ` · esforço ${range}`;
    case 'hr_zone':
      return ` · zona ${range}`;
    case 'hr_percent':
      return ` · ${range}% da FC máx.`;
    case 'ftp_percent':
      return ` · ${range}% do FTP`;
    case 'cadence':
      return ` · cadência ${range}`;
    default:
      return ` · ritmo ${range}`;
  }
}

function step(s: FitnessEnduranceStep): string {
  const size = s.distance_meters ? meters(s.distance_meters) : s.duration_seconds ? duration(s.duration_seconds) : 'livre';
  return `${STEP_LABEL[s.kind] ?? s.kind}: ${size}${target(s.target)}`;
}

/** Rótulo curto da parte (para chips): "Força · 3 exercícios", "Corrida", "WOD · AMRAP 12 min". */
export function partLabel(part: FitnessPart): string {
  switch (part.type) {
    case 'strength': {
      const n = part.items.length;
      return `Força · ${n} ${n === 1 ? 'exercício' : 'exercícios'}`;
    }
    case 'metcon':
      return `WOD · ${METCON_LABEL[part.format] ?? part.format}${part.time_cap_seconds ? ` ${duration(part.time_cap_seconds)}` : ''}`;
    case 'hyrox':
      return `Hyrox · ${part.steps.length} etapas`;
    case 'endurance':
      return SPORT_LABEL[part.sport] ?? 'Resistência';
    default:
      return part.name || 'Orientação';
  }
}

/** Linhas da ficha para partes que não são de força (força tem a lista de exercícios própria). */
export function partLines(part: FitnessPart, snapshots: FitnessExerciseSnapshot[]): string[] {
  const name = (id?: string) => snapshots.find((s) => s.id === id)?.name ?? 'Exercício';
  switch (part.type) {
    case 'metcon':
      return part.movements.map((m) => `${m.reps} ${name(m.exercise_id)}${m.load_rx ? ` · ${m.load_rx}` : ''}${m.notes ? ` (${m.notes})` : ''}`);
    case 'hyrox':
      return part.steps.map((s) => `${s.kind === 'run' ? 'Corrida' : s.name}${s.distance_meters ? ` · ${meters(s.distance_meters)}` : ''}${s.reps ? ` · ${s.reps} rep.` : ''}${s.load ? ` · ${s.load}` : ''}`);
    case 'endurance':
      return part.steps.map((s) => (s.kind === 'repeat' ? `${s.repeats} vezes: ${s.steps.map(step).join(' + ')}` : step(s)));
    case 'free_text':
      return part.text.split('\n').filter(Boolean);
    default:
      return [];
  }
}

/** Como a parte é feita no app: séries (força), gravação com GPS (corrida/bike ao ar livre) ou registrar o resultado. */
export type PartMode = 'sets' | 'gps' | 'result' | 'done';

export function partMode(part: FitnessPart): PartMode {
  if (part.type === 'strength') return 'sets';
  if (part.type === 'endurance' && (part.sport === 'run' || part.sport === 'bike')) return 'gps';
  if (part.type === 'free_text') return 'done';
  return 'result';
}

/** Distância total planejada (para mostrar a meta na gravação). */
export function plannedMeters(part: FitnessPart): number | null {
  if (part.type !== 'endurance') return null;
  let total = 0;
  for (const s of part.steps) {
    if (s.kind === 'repeat') total += s.repeats * s.steps.reduce((n, c) => n + (c.distance_meters ?? 0), 0);
    else total += s.distance_meters ?? 0;
  }
  return total || null;
}

/** Resumo do treino em chips (uma por parte). */
export function workoutChips(w: Pick<FitnessWorkoutView, 'parts'>): string[] {
  return w.parts.map(partLabel);
}
