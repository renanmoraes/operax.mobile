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
  | { type: 'free_text'; name: string; text: string };

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
  | { kind: 'sets'; sets: { item: number; set: number; done: boolean; load_kg?: number; reps?: number }[] }
  | { kind: 'done' };

export type FitnessFeeling = 'great' | 'good' | 'ok' | 'bad' | 'awful';

export interface RecordResultBody {
  workout_id: string;
  part_index: number;
  executed_on: string;
  data: FitnessResultData;
  notes?: string;
  effort?: number;
  feeling?: FitnessFeeling;
  idempotency_key: string;
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
  effort: number | null;
  volume_kg?: number;
  sets_done?: number;
  record?: boolean;
  sources: { origin: FitnessHistoryOrigin; label: string; device?: string | null }[];
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
