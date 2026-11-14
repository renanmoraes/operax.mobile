/**
 * Converte treinos do Saúde (iPhone, HealthKit) e do Health Connect (Android: Samsung Health,
 * Google Fit e outros) num formato só, pronto para mostrar e para enviar ao backend.
 * Funções puras: não importam nada nativo, então rodam nos testes e no web.
 */

export type HealthSource = 'apple_health' | 'health_connect';

export type HealthWorkout = {
  source: HealthSource;
  /** Id do registro na origem: evita importar o mesmo treino duas vezes. */
  external_id: string;
  sport: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number | null;
  energy_kcal: number | null;
  avg_hr: number | null;
  /** Relógio ou aparelho que gravou (quando a origem informa). */
  device: string | null;
  /** App que gravou no Health Connect (ex.: Samsung Health). */
  origin?: string;
};

// Valores de HKWorkoutActivityType (Apple).
const APPLE_SPORT: Record<number, string> = {
  11: 'Treino funcional',
  13: 'Ciclismo',
  14: 'Dança',
  20: 'Musculação',
  24: 'Trilha',
  37: 'Corrida',
  46: 'Natação',
  50: 'Musculação',
  52: 'Caminhada',
  57: 'Yoga',
  63: 'HIIT',
  66: 'Pilates',
};

// Valores de ExerciseSessionRecord.exerciseType (Health Connect).
const HC_SPORT: Record<number, string> = {
  8: 'Ciclismo',
  36: 'HIIT',
  37: 'Trilha',
  48: 'Pilates',
  56: 'Corrida',
  70: 'Musculação',
  74: 'Natação',
  79: 'Caminhada',
  81: 'Musculação',
  83: 'Yoga',
};

// Apps que gravam no Health Connect e que vale nomear para o aluno.
const ORIGIN_NAME: Record<string, string> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.strava': 'Strava',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.xiaomi.wearable': 'Mi Fitness',
};

export const sportFromApple = (type: number) => APPLE_SPORT[type] ?? 'Treino';
export const sportFromHealthConnect = (type: number) => HC_SPORT[type] ?? 'Treino';

type Qty = { unit: string; quantity: number } | undefined;

function toMeters(q: Qty): number | null {
  if (!q || !q.quantity) return null;
  const unit = q.unit.toLowerCase();
  const m = unit === 'km' ? q.quantity * 1000 : unit === 'mi' ? q.quantity * 1609.344 : q.quantity;
  return Math.round(m);
}

function toSeconds(q: Qty, start: Date, end: Date): number {
  if (q?.quantity) {
    const unit = q.unit.toLowerCase();
    return Math.round(unit === 'min' ? q.quantity * 60 : unit === 'hr' || unit === 'h' ? q.quantity * 3600 : q.quantity);
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

/** Formato mínimo de um treino do HealthKit que usamos (subconjunto de WorkoutSample). */
export type AppleWorkoutLike = {
  uuid: string;
  workoutActivityType: number;
  startDate: Date;
  endDate: Date;
  duration?: Qty;
  totalDistance?: Qty;
  totalEnergyBurned?: Qty;
  device?: { name?: string; model?: string };
};

export function fromAppleWorkout(w: AppleWorkoutLike, avgHr?: number | null): HealthWorkout {
  return {
    source: 'apple_health',
    external_id: w.uuid,
    sport: sportFromApple(w.workoutActivityType),
    started_at: w.startDate.toISOString(),
    duration_seconds: toSeconds(w.duration, w.startDate, w.endDate),
    distance_meters: toMeters(w.totalDistance),
    energy_kcal: w.totalEnergyBurned?.quantity ? Math.round(w.totalEnergyBurned.quantity) : null,
    avg_hr: avgHr ? Math.round(avgHr) : null,
    device: w.device?.name || w.device?.model || null,
  };
}

/** Formato mínimo de uma sessão do Health Connect que usamos. */
export type HealthConnectSessionLike = {
  startTime: string;
  endTime: string;
  exerciseType: number;
  metadata?: { id?: string; dataOrigin?: string; device?: { manufacturer?: string; model?: string } };
};

export function fromHealthConnectSession(
  s: HealthConnectSessionLike,
  extras: { distance_meters?: number | null; avg_hr?: number | null; energy_kcal?: number | null } = {},
): HealthWorkout {
  const start = new Date(s.startTime);
  const end = new Date(s.endTime);
  const dev = s.metadata?.device;
  const device = [dev?.manufacturer, dev?.model].filter(Boolean).join(' ') || null;
  const origin = s.metadata?.dataOrigin ? ORIGIN_NAME[s.metadata.dataOrigin] : undefined;
  return {
    source: 'health_connect',
    external_id: s.metadata?.id ?? `${s.startTime}-${s.exerciseType}`,
    sport: sportFromHealthConnect(s.exerciseType),
    started_at: start.toISOString(),
    duration_seconds: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)),
    distance_meters: extras.distance_meters ? Math.round(extras.distance_meters) : null,
    energy_kcal: extras.energy_kcal ? Math.round(extras.energy_kcal) : null,
    avg_hr: extras.avg_hr ? Math.round(extras.avg_hr) : null,
    device,
    ...(origin ? { origin } : {}),
  };
}
