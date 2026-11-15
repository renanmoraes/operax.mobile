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
  /** Trilha para o servidor: segundos desde o início × metros acumulados, e o caminho (latitude, longitude, altitude). */
  track: Track;
  /** Tempo em movimento (ms) ao fechar cada quilômetro: as parciais da gravação. */
  kmMarks: number[];
  /** Janela recente para o ritmo atual. */
  recent: { at: number; distanceM: number }[];
  /** Pontos descartados por imprecisão ou salto (para diagnóstico). */
  rejected: number;
};

export type Track = { t: number[]; dist: number[]; lat: number[]; lon: number[]; alt: (number | null)[] };

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
  track: { t: [], dist: [], lat: [], lon: [], alt: [] },
  kmMarks: [],
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
    return { ...state, last: p, altitudeM: p.altitude ?? state.altitudeM, altRef: p.altitude ?? state.altRef, track: pushTrack(state.track, p, startedAt, state.distanceM) };
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
  // Velocidade 0 vinda do GPS com deslocamento real é leitura faltando (comum em alguns aparelhos): usa a calculada.
  const speed = p.speed != null && p.speed > 0 ? p.speed : implied;
  const recent = [...state.recent, { at: p.at, distanceM }].filter((r) => p.at - r.at <= RECENT_WINDOW_MS);
  const movingMs = state.movingMs + dt * 1000;
  // Fechou um ou mais quilômetros neste trecho: o tempo de cada um sai da interpolação dentro do trecho.
  let kmMarks = state.kmMarks;
  for (let k = kmMarks.length + 1; moved > 0 && k * 1000 <= distanceM; k++) {
    const f = (k * 1000 - state.distanceM) / moved;
    kmMarks = [...kmMarks, state.movingMs + f * dt * 1000];
  }
  return {
    ...state,
    movingMs,
    kmMarks,
    distanceM,
    elevationGainM,
    altRef,
    altitudeM: p.altitude ?? state.altitudeM,
    maxSpeedMs: Math.max(state.maxSpeedMs, Math.min(speed, maxSpeed)),
    last: p,
    recent,
    track: pushTrack(state.track, p, startedAt, distanceM),
  };
}

/** Parcial de cada quilômetro fechado (s), mais o trecho em andamento quando passa de 50 m. */
export function kmSplits(state: RunState): { km: number; seconds: number; partial?: number }[] {
  const out: { km: number; seconds: number; partial?: number }[] = state.kmMarks.map((ms, i) => ({ km: i + 1, seconds: Math.round((ms - (state.kmMarks[i - 1] ?? 0)) / 1000) }));
  const rest = state.distanceM - state.kmMarks.length * 1000;
  if (rest >= 50) {
    const s = (state.movingMs - (state.kmMarks[state.kmMarks.length - 1] ?? 0)) / 1000;
    out.push({ km: state.kmMarks.length + 1, seconds: Math.round(s), partial: Math.round(rest) });
  }
  return out;
}

/** Depois de uma pausa: o primeiro ponto só reposiciona (o deslocamento parado não vira distância). */
export function resumeAt(state: RunState): RunState {
  return { ...state, last: null, recent: [] };
}

function pushTrack(track: Track, p: GpsPoint, startedAt: number, dist: number): Track {
  const t = Math.max(0, Math.round((p.at - startedAt) / 1000));
  const lastT = track.t[track.t.length - 1];
  const lastD = track.dist[track.dist.length - 1];
  if (lastT != null && (t <= lastT || dist < lastD)) return track;
  return {
    t: [...track.t, t],
    dist: [...track.dist, Math.round(dist * 10) / 10],
    lat: [...track.lat, Math.round(p.lat * 1e6) / 1e6],
    lon: [...track.lon, Math.round(p.lng * 1e6) / 1e6],
    alt: [...track.alt, p.altitude == null ? null : Math.round(p.altitude * 10) / 10],
  };
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

/** Trilha para o servidor: 3 a 1500 pontos (o backend recusa fora disso), com as colunas do GPS alinhadas. */
export function decimateTrack(track: Track, max = 1500): Track | undefined {
  const n = track.t.length;
  if (n < 3) return undefined;
  if (n <= max) return track;
  const step = (n - 1) / (max - 1);
  const out: Track = { t: [], dist: [], lat: [], lon: [], alt: [] };
  for (let i = 0; i < max; i++) {
    const k = Math.round(i * step);
    if (out.t.length && track.t[k] <= out.t[out.t.length - 1]) continue;
    out.t.push(track.t[k]);
    out.dist.push(track.dist[k]);
    out.lat.push(track.lat[k]);
    out.lon.push(track.lon[k]);
    out.alt.push(track.alt[k] ?? null);
  }
  return out.t.length >= 3 ? out : undefined;
}

/** Título padrão do treino livre pela hora da largada: "Corrida da manhã", "Pedalada da noite". */
export function defaultTitle(sportLabel: string, at: Date): string {
  const h = at.getHours();
  const part = h < 5 ? 'da madrugada' : h < 12 ? 'da manhã' : h < 18 ? 'da tarde' : 'da noite';
  return `${sportLabel} ${part}`;
}
