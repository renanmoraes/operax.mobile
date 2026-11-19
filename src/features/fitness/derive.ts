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

/** Relógio mede melhor que o aplicativo que só repassa; o Strava fica por último (o dado dele não se combina com o de outra fonte). */
const SOURCE_RANK = ['equipe', 'portal', 'garmin', 'polar', 'apple_health', 'health_connect', 'celular', 'strava'];
const rankOf = (e: FitnessHistoryEntry) => Math.min(...e.sources.map((s) => (SOURCE_RANK.includes(s.origin) ? SOURCE_RANK.indexOf(s.origin) : SOURCE_RANK.length)), SOURCE_RANK.length);
const onlyStrava = (e: FitnessHistoryEntry) => e.sources.length > 0 && e.sources.every((s) => s.origin === 'strava');
/** Mesma folga do backend: largada com até 10 min de diferença e duração com até 30%. */
const START_TOLERANCE_MS = 10 * 60_000;
const DURATION_TOLERANCE = 0.3;

function sameWorkout(a: FitnessHistoryEntry, b: FitnessHistoryEntry): boolean {
  // Dois treinos prescritos são sempre treinos diferentes; só o livre (do relógio ou do aplicativo) pode ser cópia.
  if (a.kind === 'prescribed' && b.kind === 'prescribed') return false;
  if (!a.started_at || !b.started_at || a.date !== b.date) return false;
  if (Math.abs(new Date(a.started_at).getTime() - new Date(b.started_at).getTime()) > START_TOLERANCE_MS) return false;
  // Esporte só conta entre dois livres; "other" casa com qualquer um.
  if (a.kind === 'free' && b.kind === 'free' && a.modality && b.modality && a.modality !== 'other' && b.modality !== 'other' && a.modality !== b.modality) return false;
  if (a.duration_seconds && b.duration_seconds) {
    const longer = Math.max(a.duration_seconds, b.duration_seconds);
    if (Math.abs(a.duration_seconds - b.duration_seconds) / longer > DURATION_TOLERANCE) return false;
  }
  return true;
}

/**
 * O mesmo treino chegando do relógio e do Strava como duas entradas vira uma só, com as duas fontes no selo.
 * Fica a entrada de quem mede melhor (treino prescrito antes do livre); do Strava não se copia número nenhum.
 */
export function mergeDuplicateEntries(entries: FitnessHistoryEntry[]): FitnessHistoryEntry[] {
  const out: FitnessHistoryEntry[] = [];
  for (const e of entries) {
    const i = out.findIndex((o) => sameWorkout(o, e));
    if (i === -1) {
      out.push(e);
      continue;
    }
    const o = out[i];
    const eFirst = (e.kind === 'prescribed' && o.kind === 'free') || (e.kind === o.kind && rankOf(e) < rankOf(o));
    const [base, other] = eFirst ? [e, o] : [o, e];
    const fill = !onlyStrava(other);
    const sources = [...base.sources];
    for (const s of other.sources) if (!sources.some((x) => x.origin === s.origin && x.label === s.label)) sources.push(s);
    out[i] = {
      ...base,
      sources,
      duration_seconds: base.duration_seconds ?? (fill ? other.duration_seconds : null),
      distance_meters: base.distance_meters ?? (fill ? other.distance_meters : null),
      avg_hr: base.avg_hr ?? (fill ? other.avg_hr : null),
      session_id: base.session_id ?? other.session_id ?? null,
    };
  }
  return out;
}
