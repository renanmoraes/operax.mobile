import { addDays, isoDate, startOfDay } from '@/src/shared/format';
import type { ActivityDetail, BodyCheckin, ChartPoint, FitnessExerciseSnapshot, FitnessHistoryEntry, FitnessWorkoutView } from './types';

/** Dados de exemplo do treino (Move Studio) até existir o login mobile de cliente. */

type Ex = Omit<FitnessExerciseSnapshot, 'modality' | 'media'>;

const EXERCISES: Ex[] = [
  { id: 'supino-reto', name: 'Supino reto com barra', muscle_group: 'Peitoral', equipment: 'Barra', instructions: 'Deite no banco com os pés firmes no chão.\nDesça a barra até tocar de leve o meio do peito.\nEmpurre até estender os braços, sem travar os cotovelos.', tips: 'Escápulas juntas o tempo todo e 3 segundos na descida.' },
  { id: 'supino-inclinado', name: 'Supino inclinado com halteres', muscle_group: 'Peitoral superior', equipment: 'Halteres', instructions: 'Banco a 30 graus.\nDesça os halteres até a linha do peito.\nSuba aproximando, sem bater um no outro.' },
  { id: 'crucifixo', name: 'Crucifixo na máquina', muscle_group: 'Peitoral', equipment: 'Máquina' },
  { id: 'crossover', name: 'Crossover na polia alta', muscle_group: 'Peitoral inferior', equipment: 'Polia' },
  { id: 'triceps-corda', name: 'Tríceps na corda', muscle_group: 'Tríceps', equipment: 'Polia' },
  { id: 'triceps-frances', name: 'Tríceps francês com halter', muscle_group: 'Tríceps', equipment: 'Halter' },
  { id: 'triceps-polia', name: 'Tríceps na polia', muscle_group: 'Tríceps', equipment: 'Polia' },
  { id: 'puxada', name: 'Puxada frontal aberta', muscle_group: 'Costas', equipment: 'Polia' },
  { id: 'remada-curvada', name: 'Remada curvada com barra', muscle_group: 'Costas', equipment: 'Barra' },
  { id: 'remada-baixa', name: 'Remada baixa no triângulo', muscle_group: 'Costas', equipment: 'Polia' },
  { id: 'pulldown', name: 'Pulldown com corda', muscle_group: 'Costas', equipment: 'Polia' },
  { id: 'rosca-direta', name: 'Rosca direta com barra', muscle_group: 'Bíceps', equipment: 'Barra' },
  { id: 'rosca-martelo', name: 'Rosca martelo', muscle_group: 'Bíceps', equipment: 'Halteres' },
  { id: 'agachamento', name: 'Agachamento livre', muscle_group: 'Quadríceps', equipment: 'Barra', instructions: 'Pés na largura dos ombros.\nDesça como se fosse sentar, joelhos na direção dos pés.\nSuba empurrando o chão.' },
  { id: 'leg-press', name: 'Leg press 45°', muscle_group: 'Quadríceps', equipment: 'Máquina' },
  { id: 'bulgaro', name: 'Agachamento búlgaro', muscle_group: 'Quadríceps', secondary_muscles: ['Glúteo máximo', 'Isquiotibiais', 'Core'], equipment: 'Halteres', instructions: 'Apoie o peito do pé de trás num banco, a uns dois passos de distância.\nDesça o quadril em linha reta até a coxa da frente ficar paralela ao chão.\nSuba empurrando pelo calcanhar da frente, sem jogar o tronco.', tips: 'Joelho da frente alinhado com o pé o tempo todo. Se doer o joelho, pare e avise o personal.' },
  { id: 'extensora', name: 'Cadeira extensora', muscle_group: 'Quadríceps', equipment: 'Máquina' },
  { id: 'flexora', name: 'Mesa flexora', muscle_group: 'Isquiotibiais', equipment: 'Máquina' },
  { id: 'elevacao-pelvica', name: 'Elevação pélvica', muscle_group: 'Glúteos', equipment: 'Barra' },
  { id: 'panturrilha', name: 'Panturrilha em pé', muscle_group: 'Panturrilha', equipment: 'Máquina' },
];

const snapshots = (ids: string[]): FitnessExerciseSnapshot[] =>
  EXERCISES.filter((e) => ids.includes(e.id)).map((e) => ({
    ...e,
    modality: 'strength',
    media: e.id === 'bulgaro' ? [{ id: 'm-bulgaro', media_file_id: 'mf-bulgaro', kind: 'video', name: 'Agachamento búlgaro — execução', mime_type: 'video/mp4', size: 4_200_000, position: 0 }] : [],
  }));

const sets = (n: number, reps: string, load: string, rest = 60) => Array.from({ length: n }, () => ({ reps, load, rest_seconds: rest }));
const ex = (exercise_id: string, n: number, reps: string, load: string, notes?: string) => ({ kind: 'exercise' as const, exercise_id, sets: sets(n, reps, load), notes });

const created = new Date(Date.now() - 20 * 86_400_000).toISOString();

export const WORKOUTS: FitnessWorkoutView[] = [
  {
    id: 'w-a',
    title: 'Treino A · Peito e tríceps',
    modality: 'strength',
    destination: 'individual',
    schedule: { mode: 'weekly', weekdays: [1, 4], starts_on: isoDate(addDays(new Date(), -20)), timezone: 'America/Sao_Paulo' },
    coach_note: 'Cadência controlada: 3 segundos na descida. No drop set do tríceps, sem descanso entre as cargas.',
    parts: [
      {
        type: 'strength',
        name: 'Peito e tríceps',
        items: [
          ex('supino-reto', 4, '10', '40 kg', 'Progressão +2,5 kg'),
          ex('supino-inclinado', 3, '12', '16 kg'),
          ex('crucifixo', 3, '12', '35 kg'),
          ex('crossover', 3, '15', '12,5 kg'),
          ex('triceps-corda', 3, '12', '20 kg'),
          ex('triceps-frances', 3, '10', '12 kg'),
          { kind: 'combined', block_kind: 'dropset', rounds: 3, rest_seconds: 75, items: [ex('triceps-polia', 1, '10', '25 kg'), ex('triceps-polia', 1, '8', '20 kg'), ex('triceps-polia', 1, '8', '15 kg')] },
        ],
      },
    ],
    exercise_snapshots: snapshots(['supino-reto', 'supino-inclinado', 'crucifixo', 'crossover', 'triceps-corda', 'triceps-frances', 'triceps-polia']),
    contact_name: 'Carlos Mendes',
    created_at: created,
    updated_at: created,
  },
  {
    id: 'w-b',
    title: 'Treino B · Costas e bíceps',
    modality: 'strength',
    destination: 'individual',
    schedule: { mode: 'weekly', weekdays: [2, 5], starts_on: isoDate(addDays(new Date(), -20)), timezone: 'America/Sao_Paulo' },
    coach_note: 'Puxe com as costas, não com o braço. Escápulas para trás antes de cada repetição.',
    parts: [
      {
        type: 'strength',
        name: 'Costas e bíceps',
        items: [ex('puxada', 4, '10', '50 kg', 'Progressão +2,5 kg'), ex('remada-curvada', 4, '8', '42,5 kg'), ex('remada-baixa', 3, '12', '45 kg'), ex('pulldown', 3, '15', '20 kg'), ex('rosca-direta', 3, '10', '20 kg'), ex('rosca-martelo', 2, '12', '10 kg')],
      },
    ],
    exercise_snapshots: snapshots(['puxada', 'remada-curvada', 'remada-baixa', 'pulldown', 'rosca-direta', 'rosca-martelo']),
    contact_name: 'Carlos Mendes',
    created_at: created,
    updated_at: created,
  },
  {
    id: 'w-c',
    title: 'Treino C · Pernas e glúteos',
    modality: 'strength',
    destination: 'individual',
    schedule: { mode: 'weekly', weekdays: [3], starts_on: isoDate(addDays(new Date(), -20)), timezone: 'America/Sao_Paulo' },
    coach_note: 'Aqueça bem o quadril. No búlgaro, joelho alinhado com o pé o tempo todo.',
    parts: [
      {
        type: 'strength',
        name: 'Pernas e glúteos',
        items: [ex('agachamento', 4, '8', '50 kg', 'Progressão +2,5 kg'), ex('leg-press', 4, '12', '140 kg'), ex('bulgaro', 3, '10', '10 kg', 'Vídeo do Carlos'), ex('extensora', 3, '12', '40 kg'), ex('flexora', 3, '12', '35 kg'), ex('elevacao-pelvica', 4, '10', '60 kg'), ex('panturrilha', 3, '15', '50 kg')],
      },
    ],
    exercise_snapshots: snapshots(['agachamento', 'leg-press', 'bulgaro', 'extensora', 'flexora', 'elevacao-pelvica', 'panturrilha']),
    contact_name: 'Carlos Mendes',
    created_at: created,
    updated_at: created,
  },
];

/** Treino planejado para um dia da semana (0 = domingo). */
export function workoutForWeekday(weekday: number) {
  return WORKOUTS.find((w) => w.schedule.weekdays?.includes(weekday)) ?? null;
}

/** Última carga registrada por exercício (para "última vez" e o gráfico de evolução). */
export const LOAD_HISTORY: Record<string, number[]> = {
  'supino-reto': [30, 32.5, 35, 35, 37.5, 37.5],
  'supino-inclinado': [10, 12, 12, 14, 16, 16],
  crucifixo: [25, 27.5, 30, 30, 32, 32],
  crossover: [7.5, 10, 10, 10, 12.5, 12.5],
  'triceps-corda': [15, 15, 17.5, 17.5, 20, 20],
  'triceps-frances': [8, 8, 10, 10, 10, 10],
  'triceps-polia': [20, 20, 22.5, 22.5, 25, 25],
  puxada: [40, 42.5, 45, 45, 47.5, 47.5],
  'remada-curvada': [32.5, 35, 37.5, 40, 40, 42.5],
  agachamento: [40, 42.5, 45, 45, 47.5, 47.5],
  bulgaro: [6, 6, 8, 8, 8, 8],
};

const DURATIONS: Record<string, number> = { 'w-a': 3120, 'w-b': 2820, 'w-c': 3480 };
const VOLUMES: Record<string, number> = { 'w-a': 5180, 'w-b': 4410, 'w-c': 6120 };

/** Histórico dos últimos 60 dias: tudo feito, com uma falta no primeiro dia de treino a partir de 12 dias atrás. */
export function buildHistory(): FitnessHistoryEntry[] {
  const today = startOfDay(new Date());
  let missBack = 12;
  while (!workoutForWeekday(addDays(today, -missBack).getDay())) missBack += 1;
  const out: FitnessHistoryEntry[] = [];
  for (let back = 1; back <= 60; back++) {
    const d = addDays(today, -back);
    const w = workoutForWeekday(d.getDay());
    if (!w || back === missBack) continue;
    out.push({
      id: `h-${isoDate(d)}`,
      kind: 'prescribed',
      date: isoDate(d),
      started_at: new Date(d.getTime() + 7 * 3_600_000).toISOString(),
      title: w.title,
      modality: 'strength',
      duration_seconds: DURATIONS[w.id] - (back % 4) * 90,
      distance_meters: null,
      avg_hr: back % 3 === 0 ? 118 : null,
      effort: 7 + (back % 3),
      volume_kg: VOLUMES[w.id] - (back % 5) * 80,
      sets_done: w.id === 'w-c' ? 24 : w.id === 'w-a' ? 22 : 19,
      record: back === 2 || back === 9,
      sources: back % 3 === 0 ? [{ origin: 'portal', label: 'App' }, { origin: 'garmin', label: 'Garmin', device: 'Forerunner 265' }] : [{ origin: 'portal', label: 'App' }],
    });
  }
  // Corridas do relógio (que também foram para o Strava), com gráficos no detalhe.
  for (const [back, seconds, meters, hr] of DEMO_RUNS) {
    const d = addDays(today, -back);
    out.push({
      id: `s:demo-run-${back}`, kind: 'free', date: isoDate(d), started_at: new Date(d.getTime() + 6 * 3_600_000 + 4 * 60_000).toISOString(), title: 'Corrida', modality: 'run',
      duration_seconds: seconds, distance_meters: meters, avg_hr: hr, energy_kcal: Math.round(meters * 0.075), effort: null, session_id: `demo-run-${back}`,
      sources: [{ origin: 'garmin', label: 'Garmin Forerunner 265', device: 'Forerunner 265' }, { origin: 'strava', label: 'Strava' }],
    });
  }
  // Natação na piscina: 11 min nadando em 40 min de relógio (pausa na borda entre as séries).
  const swimDay = addDays(today, -3);
  out.push({
    id: 's:demo-swim', kind: 'free', date: isoDate(swimDay), started_at: new Date(swimDay.getTime() + 7 * 3_600_000 + 13 * 60_000).toISOString(), title: 'Natação', modality: 'swim',
    duration_seconds: 658, distance_meters: 675, avg_hr: 133, energy_kcal: 417, effort: null, session_id: 'demo-swim',
    sources: [{ origin: 'garmin', label: 'Garmin Forerunner 265', device: 'Forerunner 265' }, { origin: 'strava', label: 'Strava' }],
  });
  return out;
}

/** Natação da demonstração: voltas de 25 a 100 m com descanso entre elas, ritmo por 100 m e zonas pela máxima na água. */
export function demoSwimDetail(entry: FitnessHistoryEntry): ActivityDetail | null {
  if (entry.modality !== 'swim') return null;
  const laps: [number, number][] = [[100, 104], [100, 98], [50, 47], [50, 46], [100, 101], [25, 22], [25, 21], [75, 72], [100, 99], [50, 48]];
  const rest = 150;
  const hrMax = 167;
  const pace: ChartPoint[] = [];
  const hr: ChartPoint[] = [];
  let t = 0;
  laps.forEach(([m, s], i) => {
    for (let k = 0; k <= 4; k++) {
      pace.push([t + Math.round((k / 4) * s), Math.round((s / m) * 100 + (k === 2 ? -2 : 1))]);
      hr.push([t + Math.round((k / 4) * s), Math.round(118 + 3 * i + k * 6)]);
    }
    t += s;
    hr.push([t + Math.round(rest / 2), 112]);
    t += rest;
  });
  const edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => Math.round(hrMax * f));
  // Cada ponto vale o tempo até o próximo, como no servidor; a pausa longa na borda não conta como esforço.
  const zoneSecs = [0, 0, 0, 0, 0];
  hr.forEach(([at, v], i) => {
    const z = v >= edges[4] ? 4 : v >= edges[3] ? 3 : v >= edges[2] ? 2 : v >= edges[1] ? 1 : v >= edges[0] ? 0 : -1;
    if (z >= 0) zoneSecs[z] += Math.min(Math.max((hr[i + 1]?.[0] ?? at + 1) - at, 0), 30);
  });
  return {
    sport: 'swim', rate_unit: 'min_100m', seconds: t, series: { rate: pace, hr },
    summary: { avg_hr: entry.avg_hr, max_hr: Math.max(...hr.map((p) => p[1])), elevation_gain_m: null, avg_cadence: null, avg_power: null },
    zones: zoneSecs.map((s, i) => ({ zone: (i + 1) as 1 | 2 | 3 | 4 | 5, from_bpm: edges[i], to_bpm: edges[i + 1], seconds: Math.round(s) })), hr_max_used: hrMax,
    splits: laps.map(([m, s], i) => ({ index: i + 1, seconds: s, distance_m: m, rate: Math.round((s / m) * 100), avg_hr: 120 + 3 * i })), split_basis: 'laps',
  };
}

/** [dias atrás, segundos, metros, FC média] das corridas da demonstração. */
const DEMO_RUNS: [number, number, number, number][] = [[1, 2235, 6300, 162], [5, 3010, 8120, 151]];

/** Detalhe sintético de uma corrida da demonstração: ritmo, frequência, altitude e cadência que oscilam como num treino de rua. */
export function demoRunDetail(entry: FitnessHistoryEntry): ActivityDetail | null {
  if (entry.modality !== 'run' || !entry.duration_seconds || !entry.distance_meters) return null;
  const total = entry.duration_seconds;
  const meanPace = (total / entry.distance_meters) * 1000;
  const n = 200;
  const ts = Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * total));
  const wave = (i: number, a: number, f: number, ph = 0) => a * Math.sin((i / n) * Math.PI * 2 * f + ph);
  const pace: ChartPoint[] = ts.map((t, i) => [t, Math.round(meanPace + wave(i, 14, 3) + wave(i, 6, 11, 1) + (i < 8 ? 40 - i * 5 : 0))]);
  const hr: ChartPoint[] = ts.map((t, i) => [t, Math.round(Math.min(186, 118 + 48 * (1 - Math.exp(-i / 18)) + wave(i, 5, 3, 0.6) + i * 0.03))]);
  const alt: ChartPoint[] = ts.map((t, i) => [t, Math.round(852 + wave(i, 9, 1.2) + wave(i, 3, 5, 2))]);
  const cad: ChartPoint[] = ts.map((t, i) => [t, Math.round(172 + wave(i, 3, 4, 0.3))]);
  const hrMax = 190;
  const edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => Math.round(hrMax * f));
  const zoneSecs = [0, 0, 0, 0, 0];
  hr.forEach(([, v]) => { const z = edges.findIndex((e, k) => k > 0 && v < e); zoneSecs[Math.max(0, (z === -1 ? 5 : z) - 1)] += total / n; });
  const km = Math.floor(entry.distance_meters / 1000);
  const splits = Array.from({ length: km }, (_, i) => {
    const secs = Math.round(meanPace + wave(i * 20, 12, 3) + (i === 0 ? 10 : 0));
    return { index: i + 1, seconds: secs, distance_m: 1000, rate: secs, avg_hr: Math.round(150 + i * 2.5) };
  });
  return {
    sport: 'run', rate_unit: 'min_km', seconds: total, series: { rate: pace, hr, alt, cad },
    summary: { avg_hr: entry.avg_hr, max_hr: Math.max(...hr.map((p) => p[1])), elevation_gain_m: 24, avg_cadence: 172, avg_power: null },
    zones: zoneSecs.map((s, i) => ({ zone: (i + 1) as 1 | 2 | 3 | 4 | 5, from_bpm: edges[i], to_bpm: edges[i + 1], seconds: Math.round(s) })), hr_max_used: hrMax,
    splits, split_basis: 'distance',
  };
}

export function buildCheckins(): BodyCheckin[] {
  const months = [5, 4, 3, 2, 1, 0];
  const weights = [72.6, 71.5, 70.6, 69.9, 69.0, 68.4];
  return months.map((m, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    d.setDate(m === 0 ? d.getDate() : 28);
    return { id: `c${i}`, date: isoDate(d), weight_kg: weights[i], body_fat_pct: 27.9 - i * 0.76, waist_cm: 80 - i * 1.2, hip_cm: 101 - i * 0.6, photo_uri: null };
  });
}
