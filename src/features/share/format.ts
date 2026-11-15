import { locale } from '@/src/i18n';
import { formatPace } from '@/src/features/fitness/runTracker';

export function distanceLabel(m: number): string {
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m / 1000)} km`;
}

export function paceLabel(distanceM: number, seconds: number): string | null {
  if (distanceM < 20 || seconds <= 0) return null;
  return `${formatPace((seconds / distanceM) * 1000)} /km`;
}

export function speedLabel(distanceM: number, seconds: number): string | null {
  if (distanceM < 20 || seconds <= 0) return null;
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((distanceM / seconds) * 3.6)} km/h`;
}

export function intLabel(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n);
}
