import { addDays, isoDate, startOfDay } from '@/src/shared/format';
import type { BodyCheckin, FitnessExerciseSnapshot, FitnessHistoryEntry, FitnessWorkoutView } from './types';

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
  return out;
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
