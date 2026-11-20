import type { ActivityDetail } from './types';

export type RateUnit = ActivityDetail['rate_unit'];

/**
 * Unidade do ritmo de cada esporte, no mesmo critério do backend (`rateUnitFor`): corrida por km, natação por 100 m,
 * remo por 500 m e o resto em velocidade. `meters` é a distância a que o ritmo se refere (null na velocidade).
 */
export const RATE_UNIT: Record<RateUnit, { label: string; meters: number | null }> = {
  min_km: { label: '/km', meters: 1000 },
  min_100m: { label: '/100 m', meters: 100 },
  min_500m: { label: '/500 m', meters: 500 },
  kmh: { label: 'km/h', meters: null },
};

/** Unidade do ritmo pelo esporte do histórico, para quando ainda não há o detalhe. Caminhada e o resto vão por km. */
export const rateUnitOfSport = (sport: string | null | undefined): RateUnit =>
  sport === 'bike' ? 'kmh' : sport === 'swim' ? 'min_100m' : sport === 'row' ? 'min_500m' : 'min_km';
