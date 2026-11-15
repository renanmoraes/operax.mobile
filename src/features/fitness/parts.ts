import type { EnduranceSport, FitnessEnduranceStep, FitnessExerciseSnapshot, FitnessPart, FitnessWorkoutView } from './types';
import i18n, { locale } from '@/src/i18n';

/**
 * Descrição em português de cada parte do treino, para qualquer modalidade (força, WOD, Hyrox,
 * corrida/bike/natação/remo, texto livre). A ficha e a aba Treino usam isto; a execução escolhe
 * a tela certa por parte (séries, gravação com GPS ou registro do resultado).
 */

/** Nome do esporte no idioma atual (lido na hora, para trocar junto com o idioma). */
export const SPORT_LABEL = new Proxy({} as Record<EnduranceSport | 'multi', string>, { get: (_t, k: string) => i18n.t(`fitness:sport.${k as EnduranceSport}`) });

const METCON = ['amrap', 'emom', 'for_time', 'tabata', 'chipper', 'intervals', 'rounds'] as const;
const metconLabel = (f: string) => ((METCON as readonly string[]).includes(f) ? i18n.t(`fitness:metcon.${f as (typeof METCON)[number]}`) : f.toUpperCase());
const stepLabel = (k: FitnessEnduranceStep['kind']) => i18n.t(`fitness:step.${k}`);

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}

const meters = (m: number) => (m >= 1000 ? `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(Math.round(m / 100) / 10)} km` : `${m} m`);

function target(t: FitnessEnduranceStep['target']): string {
  if (!t) return '';
  const range = t.max != null ? `${t.min}–${t.max}` : `${t.min}`;
  switch (t.type) {
    case 'rpe':
    case 'hr_zone':
    case 'hr_percent':
    case 'ftp_percent':
    case 'cadence':
      return i18n.t(`fitness:target.${t.type}`, { range });
    default:
      return i18n.t('fitness:target.pace', { range });
  }
}

function step(s: FitnessEnduranceStep): string {
  const size = s.distance_meters ? meters(s.distance_meters) : s.duration_seconds ? duration(s.duration_seconds) : i18n.t('fitness:step.free');
  return `${stepLabel(s.kind)}: ${size}${target(s.target)}`;
}

/** Rótulo curto da parte (para chips): "Força · 3 exercícios", "Corrida", "WOD · AMRAP 12 min". */
export function partLabel(part: FitnessPart): string {
  switch (part.type) {
    case 'strength': {
      return i18n.t('fitness:part.strength', { count: part.items.length });
    }
    case 'metcon':
      return `WOD · ${metconLabel(part.format)}${part.time_cap_seconds ? ` ${duration(part.time_cap_seconds)}` : ''}`;
    case 'hyrox':
      return i18n.t('fitness:part.hyrox', { count: part.steps.length });
    case 'endurance':
      return SPORT_LABEL[part.sport] ?? i18n.t('fitness:part.endurance');
    default:
      return part.name || i18n.t('fitness:part.guidance');
  }
}

/** Linhas da ficha para partes que não são de força (força tem a lista de exercícios própria). */
export function partLines(part: FitnessPart, snapshots: FitnessExerciseSnapshot[]): string[] {
  const name = (id?: string) => snapshots.find((s) => s.id === id)?.name ?? i18n.t('fitness:part.exercise');
  switch (part.type) {
    case 'metcon':
      return part.movements.map((m) => `${m.reps} ${name(m.exercise_id)}${m.load_rx ? ` · ${m.load_rx}` : ''}${m.notes ? ` (${m.notes})` : ''}`);
    case 'hyrox':
      return part.steps.map((s) => `${s.kind === 'run' ? i18n.t('fitness:sport.run') : s.name}${s.distance_meters ? ` · ${meters(s.distance_meters)}` : ''}${s.reps ? ` · ${i18n.t('fitness:part.reps', { count: s.reps })}` : ''}${s.load ? ` · ${s.load}` : ''}`);
    case 'endurance':
      return part.steps.map((s) => (s.kind === 'repeat' ? i18n.t('fitness:part.times', { count: s.repeats, steps: s.steps.map(step).join(' + ') }) : step(s)));
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
