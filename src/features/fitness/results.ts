import type { FitnessPart, FitnessResultData } from './types';
import i18n from '@/src/i18n';

/** "12:34" ou "1:02:03" → segundos; aceita também só minutos ("25"). */
export function parseClock(v: string): number | null {
  const parts = v.trim().split(':').map((p) => p.trim());
  if (!parts[0]) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  const secs = n.length === 1 ? n[0] * 60 : n.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2];
  return secs > 0 ? secs : null;
}

/**
 * Máscara do campo de tempo para o teclado numérico (o do iPhone não tem dois-pontos): os dígitos
 * entram da direita como num cronômetro. "5" → "0:05", "1234" → "12:34", "11500" → "1:15:00".
 */
export function maskClock(v: string): string {
  const d = v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
  if (!d) return '';
  const sec = d.slice(-2).padStart(2, '0');
  const rest = d.slice(0, -2);
  if (rest.length <= 2) return `${rest || '0'}:${sec}`;
  return `${rest.slice(0, -2)}:${rest.slice(-2)}:${sec}`;
}

/** Campo vazio é "não informado", não zero (Number('') daria 0 e salvaria um resultado zerado). */
const num = (v: string) => {
  if (!v.trim()) return null;
  const x = Number(v.replace(',', '.'));
  return Number.isFinite(x) && x >= 0 ? x : null;
};

/** Monta o resultado no formato que o backend aceita para cada modalidade (ou o motivo de não dar). */
export function buildResult(part: FitnessPart, f: { time: string; rounds: string; reps: string; kg: string; calories: string; meters: string; km: string }): { data: FitnessResultData } | { error: string } {
  if (part.type === 'metcon') {
    switch (part.result_type) {
      case 'time': {
        const s = parseClock(f.time);
        return s ? { data: { kind: 'time', seconds: s } } : { error: i18n.t('fitness:result.time') };
      }
      case 'rounds_reps': {
        const r = num(f.rounds);
        return r != null ? { data: { kind: 'rounds_reps', rounds: Math.round(r), reps: Math.round(num(f.reps) ?? 0) } } : { error: i18n.t('fitness:result.rounds') };
      }
      case 'reps': {
        const r = num(f.reps);
        return r != null ? { data: { kind: 'reps', reps: Math.round(r) } } : { error: i18n.t('fitness:result.reps') };
      }
      case 'load': {
        const k = num(f.kg);
        return k != null ? { data: { kind: 'load', kg: k } } : { error: i18n.t('fitness:result.load') };
      }
      case 'calories': {
        const c = num(f.calories);
        return c != null ? { data: { kind: 'calories', calories: Math.round(c) } } : { error: i18n.t('fitness:result.calories') };
      }
      default: {
        const m = num(f.meters);
        return m != null ? { data: { kind: 'distance', meters: m } } : { error: i18n.t('fitness:result.distance') };
      }
    }
  }
  if (part.type === 'hyrox') {
    const s = parseClock(f.time);
    return s ? { data: { kind: 'hyrox', total_seconds: s } } : { error: i18n.t('fitness:result.total') };
  }
  if (part.type === 'endurance') {
    const s = f.time.trim() ? parseClock(f.time) : null;
    const km = num(f.km);
    if (s == null && (km == null || km <= 0)) return { error: i18n.t('fitness:result.timeOrDistance') };
    return { data: { kind: 'endurance', ...(s ? { seconds: s } : {}), ...(km && km > 0 ? { distance_m: Math.round(km * 1000) } : {}) } };
  }
  return { data: { kind: 'done' } };
}

