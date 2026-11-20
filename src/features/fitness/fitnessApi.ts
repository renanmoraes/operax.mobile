import { isAxiosError } from 'axios';
import { UserFacingError } from '@/src/features/client/userFacingError';
import i18n from '@/src/i18n';
import { api } from '@/src/shared/api/client';
import { addDays, isoDate, startOfDay, startOfWeek } from '@/src/shared/format';
import { clientDataMode } from '@/src/features/client/dataMode';
import { adherenceStreak, bestAdherenceStreak, DayState, levelFromXp, mergeDuplicateEntries, mergeResultIntoHistory, xpFrom } from './derive';
import { buildCheckins, buildHistory, demoRunDetail, demoSwimDetail, LOAD_HISTORY, WORKOUTS, workoutForWeekday } from './mockData';
import type { HealthWorkout } from './health/mapWorkouts';
import type { AssessmentView } from '@/src/features/portal/assessments';
import type { ActivityDetail, BodyAssessment, BodyCheckin, FitnessEvolution, FitnessHistoryEntry, FitnessResultView, FitnessWorkoutView, FreeActivityBody, RecordResultBody, WeekView } from './types';

/**
 * Treino do cliente: `/api/public/portal/fitness/*` com o login real; no modo demonstração,
 * um store em memória com o mesmo formato.
 */

const F = '/api/public/portal/fitness';
const live = () => clientDataMode() === 'live';

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
  if (live()) {
    try {
      return (await api.get(`${F}/workouts/${id}`)).data as FitnessWorkoutView;
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  }
  await tick();
  return WORKOUTS.find((w) => w.id === id) ?? null;
}

/** GET /workouts?date= */
export async function fetchWorkoutsFor(date: Date): Promise<FitnessWorkoutView[]> {
  if (live()) {
    const { data } = await api.get(`${F}/workouts`, { params: { date: isoDate(date) } });
    return Array.isArray(data) ? (data as FitnessWorkoutView[]) : [];
  }
  await tick();
  const w = workoutForWeekday(date.getDay());
  return w ? [w] : [];
}

/** GET /week */
export async function fetchWeek(): Promise<WeekView> {
  if (live()) return (await api.get(`${F}/week`, { params: { date: todayIso() } })).data as WeekView;
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
/** O portal entrega o histórico por mês: junta os `months` mais recentes. */
async function liveHistory(months: number): Promise<FitnessHistoryEntry[]> {
  const now = new Date();
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const pages = await Promise.all(keys.map(async (month) => ((await api.get(`${F}/history`, { params: { month } })).data as { entries?: FitnessHistoryEntry[] }).entries ?? []));
  const seen = new Set<string>();
  const unique = pages.flat().filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  return mergeDuplicateEntries(unique).sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchHistory(): Promise<FitnessHistoryEntry[]> {
  if (live()) return liveHistory(3);
  await tick();
  return [...getHistory()].sort((a, b) => b.date.localeCompare(a.date));
}

/** GET /evolution */
export async function fetchEvolution(): Promise<FitnessEvolution> {
  if (live()) return (await api.get(`${F}/evolution`)).data as FitnessEvolution;
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

/** GET /media/:id — endereço assinado (5 min) do vídeo ou foto que o professor pôs no exercício. */
export async function fetchMediaUrl(mediaFileId: string): Promise<string | null> {
  if (!live()) return null;
  return ((await api.get(`${F}/media/${mediaFileId}`)).data as { url: string }).url ?? null;
}

/** Demonstração: o caminho de cada treino livre gravado nesta sessão do app, para o detalhe do histórico. */
const demoDetails = new Map<string, ActivityDetail>();

/**
 * POST /health/workouts — treinos lidos do Saúde (iPhone) ou do Health Connect (Android). O backend não duplica
 * (chave por origem e id do registro), então reenviar é seguro. No modo demonstração não manda nada.
 */
export async function sendHealthWorkouts(workouts: HealthWorkout[]): Promise<{ imported: number; matched: number; ignored: number; failed: string[] }> {
  if (!live()) return { imported: 0, matched: 0, ignored: 0, failed: [] };
  return (await api.post(`${F}/health/workouts`, { workouts })).data as { imported: number; matched: number; ignored: number; failed: string[] };
}

/** POST /activities — treino livre gravado no app (sem ficha). Idempotente por `idempotency_key`. */
export async function recordFreeActivity(body: FreeActivityBody): Promise<{ ok: true }> {
  if (live()) return (await api.post(`${F}/activities`, body)).data as { ok: true };
  await tick();
  const id = `s:demo-${body.idempotency_key}`;
  if (getHistory().some((e) => e.id === id)) return { ok: true };
  const tr = body.recording?.track;
  history = [
    {
      id, kind: 'free', date: isoDate(new Date(body.started_at)), started_at: body.started_at, title: body.title ?? i18n.t('fitness:freeWorkout'), modality: body.sport,
      duration_seconds: body.seconds, distance_meters: body.distance_m ?? null, avg_hr: null, effort: body.effort ?? null,
      sources: [{ origin: 'celular', label: i18n.t('fitness:source.phone') }], feeling: body.feeling ?? null, notes: body.notes ?? null, tag: body.tag ?? null, sets: body.sets ?? null, session_id: id,
    },
    ...getHistory(),
  ];
  const route = tr?.lat && tr.lon ? tr.lat.map((la, i) => [la, tr.lon![i]] as [number, number]) : undefined;
  demoDetails.set(id, {
    sport: body.sport, route, rate_unit: body.sport === 'bike' ? 'kmh' : 'min_km', seconds: body.seconds,
    summary: { avg_hr: null, max_hr: null, elevation_gain_m: body.elevation_gain_m ?? null, avg_cadence: null, avg_power: null },
    splits: [], split_basis: null,
  });
  return { ok: true };
}

/** GET /history/entry/detail — `null` quando o treino não tem gravação (lançado à mão, musculação). */
export async function fetchActivityDetail(id: string): Promise<ActivityDetail | null> {
  if (live()) {
    const data = (await api.get(`${F}/history/entry/detail`, { params: { id } })).data as ActivityDetail | { empty: true };
    return 'empty' in data ? null : data;
  }
  await tick();
  const entry = getHistory().find((e) => e.id === id);
  return demoDetails.get(id) ?? (entry ? (demoRunDetail(entry) ?? demoSwimDetail(entry)) : null);
}

/** POST /results — idempotente por `idempotency_key`. */
export async function recordResult(body: RecordResultBody): Promise<{ result: FitnessResultView; duplicate: boolean }> {
  if (live()) return (await api.post(`${F}/results`, body)).data as { result: FitnessResultView; duplicate: boolean };
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

/** Com o login real: dias planejados vêm do plano da semana (mesmo dia da semana), o feito vem do histórico. */
async function liveSummary() {
  const today = startOfDay(new Date());
  const [h, week, evo] = await Promise.all([liveHistory(3), fetchWeek(), fetchEvolution()]);
  const plannedWeekdays = new Set(week.days.filter((d) => d.planned > 0).map((d) => new Date(`${d.date}T12:00:00`).getDay()));
  const doneDates = new Set(h.map((e) => e.date));
  const states: DayState[] = [];
  for (let back = 45; back >= 1; back--) {
    const d = addDays(today, -back);
    states.push(doneDates.has(isoDate(d)) ? 'done' : plannedWeekdays.has(d.getDay()) ? 'missed' : 'rest');
  }
  const last28 = states.slice(-28);
  const planned28 = last28.filter((s) => s !== 'rest').length;
  const done28 = last28.filter((s) => s === 'done').length;
  const records = h.filter((e) => e.record).length;
  const monthPrefix = isoDate(today).slice(0, 7);
  const sessions = evo.total_sessions;
  const goalWeeks = evo.weekly_goal ? evo.weekly.filter((w) => w.sessions >= evo.weekly_goal!).length : 0;
  const xp = xpFrom({ sessions, records, goalWeeks });
  const streak = adherenceStreak(states);
  return {
    streak,
    bestStreak: Math.max(streak, bestAdherenceStreak(states)),
    consistency: planned28 ? Math.round((done28 / planned28) * 100) : 0,
    monthCount: h.filter((e) => e.date.startsWith(monthPrefix)).length,
    totalSessions: sessions,
    records,
    level: levelFromXp(xp),
    xp,
    dayStates: states,
  };
}

/** Resumo calculado no app: sequência, nível, consistência e meta da semana. */
export async function fetchSummary() {
  if (live()) return liveSummary();
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
type PortalAssessment = { id: string; assessed_on: string; measures: Record<string, number>; derived?: { body_fat_percent?: number | null } | null };

/** Login real: as avaliações físicas feitas pela academia viram os pontos da evolução corporal. */
export async function fetchCheckins(): Promise<BodyCheckin[]> {
  if (live()) {
    const { data } = await api.get(`${F}/assessments`);
    return ((Array.isArray(data) ? data : []) as PortalAssessment[])
      .filter((a) => typeof a.measures?.weight_kg === 'number')
      .map((a) => ({
        id: a.id,
        date: a.assessed_on,
        weight_kg: a.measures.weight_kg,
        body_fat_pct: a.derived?.body_fat_percent ?? a.measures.body_fat_percent ?? undefined,
        waist_cm: a.measures.waist_cm,
        hip_cm: a.measures.hip_cm,
        photo_uri: null,
      }))
      .sort((x, y) => x.date.localeCompare(y.date));
  }
  await tick();
  return getCheckins();
}

/** Avaliação inteira (todas as medidas), para a tela de evolução corporal. Demonstrativo: os registros corporais viram avaliações. */
export async function fetchBodyAssessments(): Promise<BodyAssessment[]> {
  if (live()) {
    const { data } = await api.get(`${F}/assessments`);
    return ((Array.isArray(data) ? data : []) as AssessmentView[])
      .map((a) => ({ ...a, measures: a.measures ?? {}, derived: a.derived ?? {}, photo_uri: null }))
      .sort((x, y) => x.assessed_on.localeCompare(y.assessed_on));
  }
  await tick();
  return getCheckins().map((c) => ({
    id: c.id,
    contact_id: 'demo',
    assessed_on: c.date,
    assessor_name: null,
    method: null,
    notes: null,
    measures: Object.fromEntries(
      Object.entries({ weight_kg: c.weight_kg, body_fat_percent: c.body_fat_pct, waist_cm: c.waist_cm, hip_cm: c.hip_cm }).filter(([, v]) => typeof v === 'number'),
    ) as Record<string, number>,
    derived: {},
    photo_uri: c.photo_uri ?? null,
  }));
}

export async function addCheckin(input: Omit<BodyCheckin, 'id'>) {
  if (live()) throw new UserFacingError(i18n.t('fitness:checkinsUnsupported'));
  await tick();
  checkins = [...getCheckins(), { ...input, id: `c-${Date.now()}` }];
}
