import { addDays, isoDate, startOfDay, startOfWeek } from '@/src/shared/format';
import { adherenceStreak, DayState, levelFromXp, mergeResultIntoHistory, xpFrom } from './derive';
import { buildCheckins, buildHistory, LOAD_HISTORY, WORKOUTS, workoutForWeekday } from './mockData';
import type { BodyCheckin, FitnessEvolution, FitnessHistoryEntry, FitnessResultView, FitnessWorkoutView, RecordResultBody, WeekView } from './types';

/**
 * Treino do cliente no formato de `/api/public/portal/fitness/*`. Store em memória até o
 * login mobile de cliente existir; cada função corresponde a uma rota do portal.
 */

const tick = () => new Promise((r) => setTimeout(r, 120));

let history: FitnessHistoryEntry[] | null = null;
let checkins: BodyCheckin[] | null = null;
const results = new Map<string, FitnessResultView>();

const getHistory = () => (history ??= buildHistory());
const getCheckins = () => (checkins ??= buildCheckins());

function todayIso() {
  return isoDate(new Date());
}

function doneToday(workoutId: string) {
  return [...results.values()].some((r) => r.workout_id === workoutId && r.executed_on === todayIso());
}

/** GET /workouts/:id */
export async function fetchWorkout(id: string): Promise<FitnessWorkoutView | null> {
  await tick();
  return WORKOUTS.find((w) => w.id === id) ?? null;
}

/** GET /workouts?date= */
export async function fetchWorkoutsFor(date: Date): Promise<FitnessWorkoutView[]> {
  await tick();
  const w = workoutForWeekday(date.getDay());
  return w ? [w] : [];
}

/** GET /week */
export async function fetchWeek(): Promise<WeekView> {
  await tick();
  const today = startOfDay(new Date());
  const start = startOfWeek(today);
  const h = getHistory();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const w = workoutForWeekday(d.getDay());
    const iso = isoDate(d);
    const done = h.some((e) => e.date === iso) || (iso === todayIso() && !!w && doneToday(w.id)) ? 1 : 0;
    return {
      date: iso,
      planned: w ? 1 : 0,
      done,
      extra: 0,
      items: w ? [{ id: w.id, title: w.title, modality: w.modality, parts: w.parts }] : [],
    };
  });
  const doneEntries = h.filter((e) => e.date >= isoDate(start));
  const next = days.find((d) => d.date >= todayIso() && d.planned && !d.done);
  return {
    start: isoDate(start),
    today: todayIso(),
    days,
    summary: {
      planned: days.reduce((n, d) => n + d.planned, 0),
      done: days.reduce((n, d) => n + d.done, 0),
      extra: 0,
      distance_meters: 0,
      duration_seconds: doneEntries.reduce((n, e) => n + (e.duration_seconds ?? 0), 0),
    },
    done: doneEntries.map((e) => ({ id: e.id, date: e.date, kind: e.kind, title: e.title, modality: e.modality, distance_meters: null, duration_seconds: e.duration_seconds })),
    next: next ? { date: next.date, workout: WORKOUTS.find((w) => w.id === next.items[0].id)! } : null,
  };
}

/** GET /history */
export async function fetchHistory(): Promise<FitnessHistoryEntry[]> {
  await tick();
  return [...getHistory()].sort((a, b) => b.date.localeCompare(a.date));
}

/** GET /evolution */
export async function fetchEvolution(): Promise<FitnessEvolution> {
  await tick();
  const start = startOfWeek(new Date());
  const h = getHistory();
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(start, -7 * (7 - i));
    const we = addDays(ws, 7);
    return { week_start: isoDate(ws), sessions: h.filter((e) => e.date >= isoDate(ws) && e.date < isoDate(we)).length };
  });
  const strength = Object.entries(LOAD_HISTORY).map(([id, loads]) => {
    const snap = WORKOUTS.flatMap((w) => w.exercise_snapshots).find((s) => s.id === id)!;
    const points = loads.map((kg, i) => ({ date: isoDate(addDays(start, -7 * (loads.length - 1 - i))), top_load_kg: kg, volume_kg: kg * 30 }));
    const best = Math.max(...loads);
    return { exercise_id: id, name: snap.name, points, record: { load_kg: best, reps: 10, date: points[loads.lastIndexOf(best)].date } };
  });
  return { strength, weekly, total_sessions: 74 + h.filter((e) => e.date >= isoDate(start)).length, weekly_goal: 5 };
}

/** POST /results — idempotente por `idempotency_key`. */
export async function recordResult(body: RecordResultBody): Promise<{ result: FitnessResultView; duplicate: boolean }> {
  await tick();
  const existing = results.get(body.idempotency_key);
  if (existing) return { result: existing, duplicate: true };
  const w = WORKOUTS.find((x) => x.id === body.workout_id)!;
  const result: FitnessResultView = {
    id: `r-${body.idempotency_key}`,
    workout_id: body.workout_id,
    workout_title: w.title,
    part_index: body.part_index,
    part_name: w.parts[body.part_index]?.name ?? '',
    executed_on: body.executed_on,
    data: body.data,
    notes: body.notes ?? null,
    effort: body.effort ?? null,
    feeling: body.feeling ?? null,
    created_at: new Date().toISOString(),
  };
  results.set(body.idempotency_key, result);
  // O treino salvo passa a contar no Histórico, na Evolução e no resumo (só na primeira vez).
  history = mergeResultIntoHistory(getHistory(), result);
  return { result, duplicate: false };
}

/** Resumo calculado no app: sequência, nível, consistência e meta da semana. */
export async function fetchSummary() {
  await tick();
  const today = startOfDay(new Date());
  const h = getHistory();
  const doneDates = new Set(h.map((e) => e.date));
  const states: DayState[] = [];
  for (let back = 45; back >= 1; back--) {
    const d = addDays(today, -back);
    const planned = !!workoutForWeekday(d.getDay());
    states.push(doneDates.has(isoDate(d)) ? 'done' : planned ? 'missed' : 'rest');
  }
  const last28 = states.slice(-28);
  const planned28 = last28.filter((s) => s !== 'rest').length;
  const done28 = last28.filter((s) => s === 'done').length;
  const records = h.filter((e) => e.record).length + 12;
  const monthPrefix = isoDate(today).slice(0, 7);
  const sessions = 74 + h.filter((e) => e.date >= isoDate(startOfWeek(today))).length;
  const xp = xpFrom({ sessions, records, goalWeeks: 6 });
  return {
    streak: adherenceStreak(states),
    bestStreak: 18,
    consistency: planned28 ? Math.round((done28 / planned28) * 100) : 0,
    monthCount: h.filter((e) => e.date.startsWith(monthPrefix)).length,
    totalSessions: sessions,
    records,
    level: levelFromXp(xp),
    xp,
    dayStates: states,
  };
}

/** Registros corporais — ainda sem rota no portal (avaliações ficam em `/assessments`). */
export async function fetchCheckins(): Promise<BodyCheckin[]> {
  await tick();
  return getCheckins();
}

export async function addCheckin(input: Omit<BodyCheckin, 'id'>) {
  await tick();
  checkins = [...getCheckins(), { ...input, id: `c-${Date.now()}` }];
}
