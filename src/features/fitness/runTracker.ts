/**
 * Cálculos da gravação de corrida/bike com o GPS do celular (função pura: testável sem aparelho).
 *
 * O GPS do celular erra: pontos com precisão ruim e "saltos" impossíveis são descartados, e a
 * altitude só conta subida acima de um limiar (senão o ruído vira centenas de metros de "ganho").
 */

export type GpsPoint = {
  /** ms desde a época (Location.timestamp). */
  at: number;
  lat: number;
  lng: number;
  altitude: number | null;
  /** Precisão horizontal em metros. */
  accuracy: number | null;
  /** m/s informado pelo GPS (pode faltar). */
  speed: number | null;
};

export type RunState = {
  /** Tempo em movimento (s), sem as pausas. */
  movingMs: number;
  distanceM: number;
  elevationGainM: number;
  maxSpeedMs: number;
  altitudeM: number | null;
  last: GpsPoint | null;
  /** Último ponto usado para a altitude (suavização). */
  altRef: number | null;
  /** Trilha para o servidor: segundos desde o início × metros acumulados. */
  track: { t: number[]; dist: number[] };
  /** Janela recente para o ritmo atual. */
  recent: { at: number; distanceM: number }[];
  /** Pontos descartados por imprecisão ou salto (para diagnóstico). */
  rejected: number;
};

export const MAX_ACCURACY_M = 25;
const ALT_STEP_M = 3;
const RECENT_WINDOW_MS = 30_000;

export const emptyRun = (): RunState => ({
  movingMs: 0,
  distanceM: 0,
  elevationGainM: 0,
  maxSpeedMs: 0,
  altitudeM: null,
  last: null,
  altRef: null,
  track: { t: [], dist: [] },
  recent: [],
  rejected: 0,
});

/** Distância entre dois pontos (fórmula de haversine), em metros. */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Soma um ponto do GPS. `startedAt` é o início da gravação (ms), `sport` define o salto máximo aceito.
 * Pausado: o chamador não deve mandar pontos (o próximo ponto depois da pausa só reposiciona).
 */
export function addPoint(state: RunState, p: GpsPoint, startedAt: number, sport: 'run' | 'bike' = 'run'): RunState {
  if (p.accuracy != null && p.accuracy > MAX_ACCURACY_M) return { ...state, rejected: state.rejected + 1 };
  const maxSpeed = sport === 'bike' ? 30 : 12; // m/s (108 km/h e 43 km/h): acima disso é salto do GPS
  if (!state.last) {
    return { ...state, last: p, altitudeM: p.altitude ?? state.altitudeM, altRef: p.altitude ?? state.altRef, track: pushTrack(state.track, p.at, startedAt, state.distanceM) };
  }
  const dt = (p.at - state.last.at) / 1000;
  if (dt <= 0) return state;
  const d = haversine(state.last, p);
  const implied = d / dt;
  if (implied > maxSpeed) return { ...state, rejected: state.rejected + 1 };

  const moved = d >= 1.5 ? d : 0; // parado no lugar: o GPS "anda" uns centímetros; não conta
  const distanceM = state.distanceM + moved;
  let { elevationGainM, altRef } = state;
  if (p.altitude != null) {
    if (altRef == null) altRef = p.altitude;
    else if (p.altitude - altRef >= ALT_STEP_M) {
      elevationGainM += p.altitude - altRef;
      altRef = p.altitude;
    } else if (altRef - p.altitude >= ALT_STEP_M) altRef = p.altitude;
  }
  const speed = p.speed != null && p.speed >= 0 ? p.speed : implied;
  const recent = [...state.recent, { at: p.at, distanceM }].filter((r) => p.at - r.at <= RECENT_WINDOW_MS);
  return {
    ...state,
    movingMs: state.movingMs + dt * 1000,
    distanceM,
    elevationGainM,
    altRef,
    altitudeM: p.altitude ?? state.altitudeM,
    maxSpeedMs: Math.max(state.maxSpeedMs, Math.min(speed, maxSpeed)),
    last: p,
    recent,
    track: pushTrack(state.track, p.at, startedAt, distanceM),
  };
}

/** Depois de uma pausa: o primeiro ponto só reposiciona (o deslocamento parado não vira distância). */
export function resumeAt(state: RunState): RunState {
  return { ...state, last: null, recent: [] };
}

function pushTrack(track: RunState['track'], at: number, startedAt: number, dist: number) {
  const t = Math.max(0, Math.round((at - startedAt) / 1000));
  const lastT = track.t[track.t.length - 1];
  const lastD = track.dist[track.dist.length - 1];
  if (lastT != null && (t <= lastT || dist < lastD)) return track;
  return { t: [...track.t, t], dist: [...track.dist, Math.round(dist * 10) / 10] };
}

/** Ritmo atual (s/km) pelos últimos 30 s; `null` parado ou sem dados. */
export function currentPace(state: RunState): number | null {
  const r = state.recent;
  if (r.length < 2) return null;
  const d = r[r.length - 1].distanceM - r[0].distanceM;
  const s = (r[r.length - 1].at - r[0].at) / 1000;
  if (d < 10 || s <= 0) return null;
  return (s / d) * 1000;
}

/** Ritmo médio (s/km) do tempo em movimento. */
export function averagePace(state: RunState, elapsedS: number): number | null {
  if (state.distanceM < 20 || elapsedS <= 0) return null;
  return (elapsedS / state.distanceM) * 1000;
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm > 3600) return "–'––\"";
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, '0')}"`;
}

export function formatKm(m: number): string {
  return (m / 1000).toFixed(2).replace('.', ',');
}

/** Trilha para o servidor: 3 a 1500 pontos (o backend recusa fora disso). */
export function decimateTrack(track: RunState['track'], max = 1500): RunState['track'] | undefined {
  const n = track.t.length;
  if (n < 3) return undefined;
  if (n <= max) return track;
  const step = (n - 1) / (max - 1);
  const t: number[] = [];
  const dist: number[] = [];
  for (let i = 0; i < max; i++) {
    const k = Math.round(i * step);
    if (t.length && track.t[k] <= t[t.length - 1]) continue;
    t.push(track.t[k]);
    dist.push(track.dist[k]);
  }
  return t.length >= 3 ? { t, dist } : undefined;
}
