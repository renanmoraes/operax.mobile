/**
 * Tipos da API de treino do portal do cliente (`/api/public/portal/fitness/*`),
 * copiados de operax-frontend/src/apps/fitness/lib/types.ts e dos serviços do backend.
 */

export type FitnessModality = 'hyrox' | 'strength' | 'wod' | 'run' | 'bike' | 'swim';

export interface FitnessExerciseInput {
  category?: 'force' | 'gymnastics' | 'olympic' | 'cardio' | 'hyrox';
  name: string;
  modality: FitnessModality;
  muscle_group?: string;
  secondary_muscles?: string[];
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string;
  tips?: string;
}

export interface FitnessMediaView {
  id: string;
  media_file_id: string;
  kind: 'image' | 'gif' | 'video';
  name: string;
  mime_type: string;
  size: number;
  position: number;
}

export interface FitnessSet {
  reps: string;
  load?: string;
  rest_seconds: number;
  notes?: string;
}

export interface FitnessExerciseItem {
  kind: 'exercise';
  exercise_id: string;
  sets: FitnessSet[];
  notes?: string;
}

export interface FitnessCombinedItem {
  kind: 'combined';
  block_kind: 'superset' | 'biset' | 'triset' | 'circuit' | 'dropset' | 'rest_pause' | 'pyramid' | 'cluster' | 'giant_set';
  rounds: number;
  rest_seconds: number;
  items: FitnessExerciseItem[];
}

export type FitnessPart =
  | { type: 'strength'; name: string; items: (FitnessExerciseItem | FitnessCombinedItem)[] }
  | {
      type: 'metcon';
      name: string;
      format: 'amrap' | 'emom' | 'for_time' | 'tabata' | 'chipper' | 'intervals' | 'rounds';
      time_cap_seconds?: number;
      interval_seconds?: number;
      result_type: 'time' | 'rounds_reps' | 'reps' | 'load' | 'calories' | 'distance';
      movements: { exercise_id: string; reps: string; load_rx?: string; notes?: string }[];
    }
  | {
      type: 'hyrox';
      name: string;
      division?: string;
      steps: { kind: 'run' | 'station' | 'transition'; name: string; exercise_id?: string; distance_meters?: number; reps?: number; load?: string; target_seconds?: number }[];
    }
  | { type: 'endurance'; name: string; sport: EnduranceSport | 'multi'; steps: (FitnessEnduranceStep | { kind: 'repeat'; repeats: number; steps: FitnessEnduranceStep[] })[] }
  | { type: 'free_text'; name: string; text: string };

export type EnduranceSport = 'run' | 'bike' | 'swim' | 'row';

/** Passo de um treino de resistência (corrida, bike, natação, remo), igual ao backend. */
export interface FitnessEnduranceStep {
  kind: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'rest';
  duration_seconds?: number;
  distance_meters?: number;
  manual?: true;
  sport?: EnduranceSport;
  target?: { type: 'hr_zone' | 'hr_percent' | 'ftp_percent' | 'pace_percent' | 'pace' | 'rpe' | 'cadence'; min: number; max?: number };
}

export interface FitnessSchedule {
  mode: 'daily' | 'weekly' | 'once';
  starts_on: string;
  ends_on?: string;
  weekdays?: number[];
  timezone: string;
}

export interface FitnessExerciseSnapshot extends FitnessExerciseInput {
  id: string;
  media: FitnessMediaView[];
}

export interface FitnessWorkoutView {
  id: string;
  title: string;
  modality: FitnessModality;
  destination: 'collective' | 'individual' | 'template';
  schedule: FitnessSchedule;
  parts: FitnessPart[];
  exercise_snapshots: FitnessExerciseSnapshot[];
  contact_name?: string | null;
  created_at: string;
  updated_at: string;
  /** Observação do profissional na ficha (exibida no topo). */
  coach_note?: string;
}

export interface WeekView {
  start: string;
  today: string;
  days: {
    date: string;
    planned: number;
    done: number;
    extra: number;
    items?: { id: string; title: string; modality: FitnessModality; parts: FitnessPart[] }[];
  }[];
  summary: { planned: number; done: number; extra: number; distance_meters: number; duration_seconds: number };
  done: { id: string; date: string; kind: 'prescribed' | 'free'; title: string; modality: string | null; distance_meters: number | null; duration_seconds: number | null }[];
  next: { date: string; workout: FitnessWorkoutView } | null;
}

export type FitnessResultData =
  | { kind: 'time'; seconds: number }
  | { kind: 'rounds_reps'; rounds: number; reps: number }
  | { kind: 'reps'; reps: number }
  | { kind: 'load'; kg: number }
  | { kind: 'calories'; calories: number }
  | { kind: 'distance'; meters: number }
  | { kind: 'hyrox'; total_seconds: number; steps?: { index: number; seconds: number }[] }
  | { kind: 'endurance'; seconds?: number; distance_m?: number; avg_hr?: number }
  | { kind: 'sets'; sets: { item: number; set: number; done: boolean; load_kg?: number; reps?: number }[] }
  | { kind: 'done' };

export type FitnessWodLevel = 'rx' | 'scaled' | 'beginner';

export type FitnessFeeling = 'great' | 'good' | 'ok' | 'bad' | 'awful';

export interface RecordResultBody {
  workout_id: string;
  part_index: number;
  executed_on: string;
  data: FitnessResultData;
  /** WOD: Prescrito, Adaptado ou Iniciante (obrigatório para WOD no backend). */
  level?: FitnessWodLevel;
  notes?: string;
  effort?: number;
  feeling?: FitnessFeeling;
  idempotency_key: string;
  /** Gravação do celular (corrida/bike com GPS): início e trilha tempo × distância, com o caminho. */
  recording?: { started_at: string; track?: RecordingTrack };
}

export interface FitnessResultView {
  id: string;
  workout_id: string;
  workout_title: string;
  part_index: number;
  part_name: string;
  executed_on: string;
  data: FitnessResultData;
  notes: string | null;
  effort: number | null;
  feeling: FitnessFeeling | null;
  created_at: string;
}

export type FitnessHistoryOrigin = 'portal' | 'equipe' | 'garmin' | 'strava' | 'polar' | 'celular';

/** Trilha da gravação: segundos desde a largada, metros acumulados e, com GPS, o caminho (latitude, longitude, altitude). */
export type RecordingTrack = { t: number[]; dist: number[]; lat?: number[]; lon?: number[]; alt?: (number | null)[] };

/** Esportes do treino livre (o backend aceita os mesmos). */
export type FreeSport = 'run' | 'walk' | 'bike' | 'strength' | 'swim' | 'other';

/** POST /fitness/activities — treino livre gravado no app, idempotente pela chave. */
export interface FreeActivityBody {
  sport: FreeSport;
  started_at: string;
  seconds: number;
  distance_m?: number;
  elevation_gain_m?: number;
  title?: string;
  feeling?: FitnessFeeling;
  effort?: number;
  notes?: string;
  /** Tipo do treino (regenerativo, longão, força…). */
  tag?: string;
  /** Musculação: séries marcadas. */
  sets?: number;
  /** Natação: tamanho da piscina (m) e piscinas nadadas (a distância vai em `distance_m`). A API ainda não guarda. */
  pool_length_m?: number;
  pool_lengths?: number;
  idempotency_key: string;
  recording?: { track?: RecordingTrack };
}

/** Séries do gráfico do treino: frequência, ritmo (ou velocidade), altitude, cadência e potência. */
export type SeriesKey = 'hr' | 'rate' | 'alt' | 'cad' | 'pw';
/** Ponto do gráfico: segundos desde a largada e o valor. */
export type ChartPoint = [number, number];

/** GET /history/entry/detail — o caminho, as parciais, os gráficos e o resumo da sessão gravada. */
export interface ActivityDetail {
  sport: string | null;
  route?: [number, number][];
  rate_unit: 'min_km' | 'min_100m' | 'min_500m' | 'kmh';
  seconds: number;
  /** Até 240 pontos por série; só vem a série que o aparelho mediu. Ausente em versões antigas da API. */
  series?: Partial<Record<SeriesKey, ChartPoint[]>>;
  /** Tempo em cada zona de frequência; null sem frequência ou sem saber a máxima do aluno. */
  zones?: { zone: 1 | 2 | 3 | 4 | 5; from_bpm: number; to_bpm: number; seconds: number }[] | null;
  hr_max_used?: number | null;
  summary: { avg_hr: number | null; max_hr: number | null; elevation_gain_m: number | null; avg_cadence: number | null; avg_power: number | null };
  splits: { index: number; seconds: number; distance_m: number | null; rate: number | null; avg_hr: number | null }[];
  split_basis: 'laps' | 'distance' | null;
}

export interface FitnessHistoryEntry {
  id: string;
  kind: 'prescribed' | 'free';
  date: string;
  started_at: string | null;
  title: string;
  modality: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_hr: number | null;
  /** Calorias que o relógio ou o Saúde do celular mediram. Ausente em versões antigas da API. */
  energy_kcal?: number | null;
  effort: number | null;
  volume_kg?: number;
  sets_done?: number;
  record?: boolean;
  sources: { origin: FitnessHistoryOrigin; label: string; device?: string | null }[];
  /** Treino livre do app: como o aluno disse que foi e o que anotou. */
  feeling?: FitnessFeeling | null;
  notes?: string | null;
  tag?: string | null;
  sets?: number | null;
  session_id?: string | null;
}

export interface FitnessHistory {
  month: string;
  is_current: boolean;
  is_oldest: boolean;
  entries: FitnessHistoryEntry[];
}

export interface FitnessEvolution {
  strength: {
    exercise_id: string;
    name: string;
    points: { date: string; top_load_kg: number; volume_kg: number }[];
    record: { load_kg: number; reps: number | null; date: string } | null;
  }[];
  weekly: { week_start: string; sessions: number }[];
  total_sessions: number;
  weekly_goal: number | null;
}

export interface MessageView {
  id: string;
  from: 'student' | 'staff';
  body: string;
  at: string;
}

export interface ProviderView {
  id: 'strava' | 'polar' | 'garmin' | 'coros' | 'zepp' | 'apple';
  label: string;
  state: 'available' | 'soon';
  connected: boolean;
  status: 'connected' | 'revoked' | 'error' | null;
  last_sync_at: string | null;
  last_error: string | null;
  imported: number;
  /** O provedor recebe treino do Operax (Garmin). Ausente em versões antigas da API. */
  can_push?: boolean;
  /** Preferências de envio ao relógio do aluno: mandar sozinho e quais tipos de treino. */
  push?: WatchPushPrefs | null;
}

/** Tipos de treino que podem ir para o relógio (corrida, bike, natação e remo são resistência; funcional junta metcon e hyrox). */
export type WatchKind = 'run' | 'bike' | 'swim' | 'row' | 'strength' | 'functional';

export interface WatchPushPrefs {
  auto: boolean;
  kinds: WatchKind[];
}

export interface ImportedSessionView {
  id: string;
  provider: string;
  started_at: string;
  sport: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_hr: number | null;
  status: 'imported' | 'unmatched';
  sources: { provider: string; device: string | null; duration_seconds: number | null; distance_meters: number | null; avg_hr: number | null }[];
}

/** Registros corporais (peso, medidas, fotos de evolução) — visão do app; ainda sem rota no portal. */
export interface BodyCheckin {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct?: number;
  waist_cm?: number;
  hip_cm?: number;
  photo_uri?: string | null;
}
