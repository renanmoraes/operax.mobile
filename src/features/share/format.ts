import { locale } from '@/src/i18n';
import { RATE_UNIT, type RateUnit } from '@/src/features/fitness/rateUnit';
import { formatPace } from '@/src/features/fitness/runTracker';

export function distanceLabel(m: number): string {
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m / 1000)} km`;
}

/** Ritmo já com a unidade do esporte (por km, por 100 m na natação, por 500 m no remo). */
export function paceLabel(distanceM: number, seconds: number, unit: RateUnit = 'min_km'): string | null {
  const per = RATE_UNIT[unit === 'kmh' ? 'min_km' : unit];
  if (distanceM < 20 || seconds <= 0) return null;
  return `${formatPace((seconds / distanceM) * per.meters!)} ${per.label}`;
}

export function speedLabel(distanceM: number, seconds: number): string | null {
  if (distanceM < 20 || seconds <= 0) return null;
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((distanceM / seconds) * 3.6)} km/h`;
}

export function intLabel(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n);
}
