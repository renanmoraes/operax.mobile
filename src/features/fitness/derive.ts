import type { FitnessHistoryEntry, FitnessResultView } from './types';
import i18n from '@/src/i18n';

/**
 * Regras calculadas no app: o portal não tem rota de consistência/streak nem de gamificação
 * para o cliente (só a visão da equipe), então derivamos de semana + histórico.
 */

export type DayState = 'done' | 'missed' | 'extra' | 'rest' | 'future';

/** Dias seguidos cumprindo o plano até ontem. Descanso programado mantém a sequência, mas sozinho não cria. */
export function adherenceStreak(daysOldestToYesterday: DayState[]): number {
  let streak = 0;
  let sawTraining = false;
  for (let i = daysOldestToYesterday.length - 1; i >= 0; i--) {
    const s = daysOldestToYesterday[i];
    if (s === 'missed') break;
    if (s === 'future') continue;
    if (s === 'done' || s === 'extra') sawTraining = true;
    streak += 1;
  }
  return sawTraining ? streak : 0;
}

/** Maior sequência no período (mesma regra de `adherenceStreak`, em qualquer trecho). */
export function bestAdherenceStreak(days: DayState[]): number {
  let best = 0;
  let run = 0;
  let sawTraining = false;
  for (const s of days) {
    if (s === 'future') continue;
    if (s === 'missed') {
      run = 0;
      sawTraining = false;
      continue;
    }
    if (s === 'done' || s === 'extra') sawTraining = true;
    run += 1;
    if (sawTraining) best = Math.max(best, run);
  }
  return best;
}

export function xpFrom(input: { sessions: number; records: number; goalWeeks: number }) {
  return input.sessions * 50 + input.records * 30 + input.goalWeeks * 120;
}

const LEVEL_STEP = 200;
const LABELS: [number, 'beginner' | 'steady' | 'intermediate' | 'advanced' | 'elite'][] = [
  [1, 'beginner'],
  [4, 'steady'],
  [6, 'intermediate'],
  [10, 'advanced'],
  [15, 'elite'],
];

/** Cada nível pede 200 XP a mais que o anterior (200, 400, 600…). */
export function levelFromXp(xp: number) {
  let level = 1;
  let floor = 0;
  let need = LEVEL_STEP;
  while (xp >= floor + need) {
    floor += need;
    level += 1;
    need = LEVEL_STEP * level;
  }
  const label = i18n.t(`fitness:level.${LABELS.reduce((acc, [min, name]) => (level >= min ? name : acc), LABELS[0][1])}`);
  return { level, current: xp - floor, next: need, label };
}

/**
 * Coloca um treino salvo no histórico (que alimenta Histórico, Evolução e o resumo).
 * Vários blocos do mesmo treino no mesmo dia viram uma entrada só, somando séries e volume.
 */
export function mergeResultIntoHistory(
  history: FitnessHistoryEntry[],
  result: Pick<FitnessResultView, 'workout_id' | 'workout_title' | 'executed_on' | 'created_at' | 'data' | 'effort'>,
): FitnessHistoryEntry[] {
  const sets = result.data.kind === 'sets' ? result.data.sets.filter((s) => s.done) : [];
  const volume = sets.reduce((sum, s) => sum + (s.load_kg ?? 0) * (s.reps ?? 0), 0);
  const id = `res-${result.workout_id}-${result.executed_on}`;
  const existing = history.find((e) => e.id === id);
  if (existing) {
    const merged: FitnessHistoryEntry = {
      ...existing,
      sets_done: (existing.sets_done ?? 0) + sets.length,
      volume_kg: (existing.volume_kg ?? 0) + volume,
      effort: result.effort ?? existing.effort,
    };
    return history.map((e) => (e.id === id ? merged : e));
  }
  const entry: FitnessHistoryEntry = {
    id,
    kind: 'prescribed',
    date: result.executed_on,
    started_at: result.created_at,
    title: result.workout_title,
    modality: 'strength',
    duration_seconds: null,
    distance_meters: null,
    avg_hr: null,
    effort: result.effort ?? null,
    volume_kg: volume || undefined,
    sets_done: sets.length || undefined,
    sources: [{ origin: 'portal', label: 'App' }],
  };
  return [entry, ...history];
}
