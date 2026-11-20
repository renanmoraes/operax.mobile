import type { ActivityDetail, FitnessHistoryEntry } from '@/src/features/fitness/types';
import { rateUnitOfSport } from '@/src/features/fitness/rateUnit';
import { paceLabel, speedLabel } from './format';
import type { ShareActivity, ShareGps, ShareStrength } from './types';

type Base = { title: string; company: string; date: string; seconds: number; energyKcal?: number | null };

function gpsBlock(p: {
  sport: string;
  distanceM: number;
  seconds: number;
  preferSpeed: boolean;
  avgHr?: number | null;
  maxHr?: number | null;
  elevationGainM?: number | null;
  route?: [number, number][];
  splits?: { index: number; seconds: number }[];
  splitsKind?: ShareGps['splitsKind'];
}): ShareGps {
  const pace = paceLabel(p.distanceM, p.seconds, rateUnitOfSport(p.sport));
  const speed = speedLabel(p.distanceM, p.seconds);
  return {
    sport: p.sport,
    distanceM: p.distanceM,
    rateLabel: (p.preferSpeed ? speed : pace) ?? '–',
    paceLabel: pace,
    speedLabel: speed,
    avgHr: p.avgHr ?? null,
    maxHr: p.maxHr ?? null,
    elevationGainM: p.elevationGainM ?? null,
    route: p.route ?? [],
    splits: p.splits ?? [],
    splitsKind: p.splitsKind ?? (p.sport === 'swim' ? '100m' : 'km'),
  };
}

export function fromStrength(base: Base, s: Partial<ShareStrength>): ShareActivity {
  return {
    kind: 'strength',
    ...base,
    strength: {
      volumeKg: s.volumeKg ?? null,
      setsDone: s.setsDone ?? null,
      setsTotal: s.setsTotal ?? null,
      records: s.records ?? [],
      volumeHistory: s.volumeHistory ?? [],
    },
  };
}

/** Fim de uma gravação com GPS (resumo do Recorder). `kmMarks`: tempo em movimento (ms) ao fechar cada km. */
export function fromRecording(
  base: Base,
  r: { sport: string; preferSpeed: boolean; distanceM: number; elevationGainM: number; route: [number, number][]; kmMarks: number[] },
): ShareActivity {
  const splits = r.kmMarks.map((ms, i) => ({ index: i + 1, seconds: Math.round((ms - (r.kmMarks[i - 1] ?? 0)) / 1000) }));
  return {
    kind: 'gps',
    ...base,
    gps: gpsBlock({ sport: r.sport, distanceM: r.distanceM, seconds: base.seconds, preferSpeed: r.preferSpeed, elevationGainM: r.elevationGainM, route: r.route, splits }),
  };
}

/** Item do histórico, com o detalhe da gravação quando existir. */
export function fromHistoryDetail(entry: FitnessHistoryEntry, detail: ActivityDetail | null, company: string): ShareActivity {
  // O tempo do histórico é o em movimento (o mesmo da tela do treino). O das amostras conta as pausas: numa natação de 11 min
  // parado na borda vira 41 min e o ritmo sai vazio.
  const seconds = entry.duration_seconds ?? detail?.seconds ?? 0;
  const base: Base = { title: entry.title, company, date: entry.started_at ?? entry.date, seconds, energyKcal: entry.energy_kcal ?? null };
  const route = detail?.route ?? [];
  const distanceM = entry.distance_meters ?? 0;
  if (route.length > 1 || distanceM > 0) {
    return {
      kind: 'gps',
      ...base,
      gps: gpsBlock({
        sport: detail?.sport ?? entry.modality ?? '',
        distanceM,
        seconds,
        preferSpeed: detail?.rate_unit === 'kmh' || entry.modality === 'bike',
        avgHr: detail?.summary.avg_hr ?? entry.avg_hr ?? null,
        maxHr: detail?.summary.max_hr ?? null,
        elevationGainM: detail?.summary.elevation_gain_m ?? null,
        route,
        // Uma volta só (o treino inteiro) não é parcial; musculação já chega do servidor sem nenhuma.
        splits: (detail?.splits.length ?? 0) > 1 ? detail!.splits.map((s) => ({ index: s.index, seconds: s.seconds })) : [],
        splitsKind: detail?.split_basis === 'laps' ? 'laps' : undefined,
      }),
    };
  }
  return fromStrength(base, { volumeKg: entry.volume_kg ?? null, setsDone: entry.sets_done ?? entry.sets ?? null });
}
