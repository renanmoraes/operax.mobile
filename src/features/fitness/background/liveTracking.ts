import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { colors } from '@/src/design-system/tokens';
import { kvGet, kvSet } from '@/src/shared/db/localDb';
import { reportError } from '@/src/shared/telemetry/errorReporter';
import type { GpsPoint } from '../runTracker';

/**
 * GPS da gravação com a tela bloqueada ou o app em segundo plano.
 *
 * - iPhone: atualização de localização em segundo plano (`UIBackgroundModes: location`), com a faixa azul
 *   do sistema. Basta a permissão "durante o uso", porque a gravação começa com o app na frente.
 * - Android: serviço em primeiro plano com notificação fixa (exigência do sistema para o GPS seguir
 *   ligado). Também basta a permissão "durante o uso"; nada de "o tempo todo".
 *
 * Os pontos chegam pela tarefa `LIVE_TASK` (definida ao carregar este arquivo, inclusive quando o Android
 * acorda o app sem tela) e vão para quem grava (`onLiveFixes`). Todo ponto também fica guardado no aparelho
 * até o próximo rascunho da gravação: se o app for fechado no meio, nada do caminho se perde.
 */
export const LIVE_TASK = 'operax-workout-gps';
const BUFFER_KEY = 'fitness_live_points';
const META_KEY = 'fitness_live_meta';
/** Teto da reserva (~4 h a 1 ponto/s): o rascunho esvazia ela a cada 10 s; isto só cresce com o app fechado. */
const BUFFER_MAX = 15_000;

/** Qual gravação está com o GPS ligado: a tela para voltar e quando começou. */
export type LiveMeta = { route: string; draftKey: string; startedAt: number };

type Listener = (points: GpsPoint[]) => void;
let listener: Listener | null = null;
let buffer: GpsPoint[] | null = null;
let chain: Promise<unknown> = Promise.resolve();
/** Gravações em fila: a reserva é lida, mudada e gravada uma de cada vez. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

export const toGpsPoint = (l: Location.LocationObject): GpsPoint => ({
  at: l.timestamp,
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  altitude: l.coords.altitude ?? null,
  accuracy: l.coords.accuracy ?? null,
  speed: l.coords.speed ?? null,
});

/** Quem grava recebe os pontos ao vivo. Devolve o "desligar". */
export function onLiveFixes(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

async function loadBuffer(): Promise<GpsPoint[]> {
  if (!buffer) buffer = (await kvGet<GpsPoint[]>(BUFFER_KEY)) ?? [];
  return buffer;
}

/** Junta pontos à reserva (sem repetir horário) e grava no aparelho. */
export function bufferPoints(points: GpsPoint[]): Promise<void> {
  return serial(async () => {
    const cur = await loadBuffer();
    const last = cur[cur.length - 1]?.at ?? 0;
    const fresh = points.filter((p) => p.at > last).sort((a, b) => a.at - b.at);
    if (!fresh.length) return;
    buffer = [...cur, ...fresh].slice(-BUFFER_MAX);
    await kvSet(BUFFER_KEY, buffer);
  });
}

/** O rascunho foi guardado em `at`: os pontos até ali já estão nele. */
export function trimBuffer(at: number): Promise<void> {
  return serial(async () => {
    const cur = await loadBuffer();
    const keep = cur.filter((p) => p.at > at);
    if (keep.length === cur.length) return;
    buffer = keep;
    await kvSet(BUFFER_KEY, keep);
  });
}

/** Pontos guardados depois de `after` (o app foi fechado no meio): a gravação retomada soma eles. */
export function bufferedSince(after: number): Promise<GpsPoint[]> {
  return serial(async () => (await loadBuffer()).filter((p) => p.at > after));
}

export function clearBuffer(): Promise<void> {
  return serial(async () => {
    buffer = [];
    await kvSet(BUFFER_KEY, []);
  });
}

export async function handleLiveTask({ data, error }: { data: unknown; error: { message: string } | null }) {
  if (error) {
    void reportError(new Error(error.message), { context: 'gps segundo plano' });
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations ?? [];
  const points = locations.map(toGpsPoint);
  if (!points.length) return;
  try {
    listener?.(points);
  } finally {
    await bufferPoints(points);
  }
}

const native = Platform.OS === 'ios' || Platform.OS === 'android';
if (native) {
  try {
    TaskManager.defineTask(LIVE_TASK, handleLiveTask as never);
  } catch (e) {
    void reportError(e, { context: 'gps definir tarefa' });
  }
}

/** Liga o GPS que segue com a tela bloqueada. `false`: não deu (Expo Go, web, aparelho sem suporte); a tela usa o GPS comum. */
export async function startLiveTracking(meta: LiveMeta, notice: { title: string; body: string }): Promise<boolean> {
  if (!native) return false;
  try {
    if (!(await TaskManager.isAvailableAsync())) return false;
    await Location.startLocationUpdatesAsync(LIVE_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 2,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: notice.title, notificationBody: notice.body, notificationColor: colors.primary, killServiceOnDestroy: false },
    });
    await kvSet(META_KEY, meta);
    return true;
  } catch (e) {
    void reportError(e, { context: 'gps segundo plano iniciar' });
    return false;
  }
}

export async function isLiveTrackingOn(): Promise<boolean> {
  if (!native) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LIVE_TASK);
  } catch {
    return false;
  }
}

export async function stopLiveTracking(): Promise<void> {
  if (!native) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LIVE_TASK)) await Location.stopLocationUpdatesAsync(LIVE_TASK);
  } catch (e) {
    void reportError(e, { context: 'gps segundo plano parar' });
  }
  await kvSet(META_KEY, null);
}

/** Gravação com o GPS ainda ligado (o app foi reaberto no meio dela): a tela para voltar. */
export async function liveRecordingToResume(): Promise<LiveMeta | null> {
  if (!(await isLiveTrackingOn())) return null;
  return kvGet<LiveMeta>(META_KEY);
}
