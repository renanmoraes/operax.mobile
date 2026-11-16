import i18n, { locale } from '@/src/i18n';
import { formatClock } from '@/src/shared/format';
import { averagePace, formatKm, formatPace, MAX_ACCURACY_M } from '../runTracker';

/**
 * Regras da gravação que não dependem do aparelho (testáveis sem GPS nem notificação): quando o Iniciar
 * libera, o tamanho da piscina, o tempo ao retomar depois de o app ter sido fechado e o texto do resumo
 * que aparece na tela bloqueada.
 */

/** Procurando por mais que isto sem um sinal bom: aparece a saída "Iniciar sem GPS". */
export const NO_GPS_OFFER_MS = 20_000;

export type GpsGate =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'denied' | 'servicesOff' | 'searching' | 'weak'; offerNoGps: boolean };

/**
 * Iniciar só libera com uma posição boa (precisão até 25 m, a mesma que a gravação aceita): sem isso o
 * começo do caminho sai torto e a exportação fica sem trilha. Sem permissão, GPS desligado ou muito tempo
 * procurando, o aluno não fica preso: aparece "Iniciar sem GPS", que grava só o tempo.
 */
export function gpsGate(s: { perm: 'unknown' | 'granted' | 'denied'; servicesOn: boolean | null; hasFix: boolean; accuracy: number | null; searchingMs: number }): GpsGate {
  const waited = s.searchingMs >= NO_GPS_OFFER_MS;
  if (s.perm === 'unknown') return { ok: false, reason: 'permission', offerNoGps: waited };
  if (s.perm === 'denied') return { ok: false, reason: 'denied', offerNoGps: true };
  if (s.servicesOn === false) return { ok: false, reason: 'servicesOff', offerNoGps: true };
  if (!s.hasFix || s.accuracy == null) return { ok: false, reason: 'searching', offerNoGps: waited };
  if (s.accuracy > MAX_ACCURACY_M) return { ok: false, reason: 'weak', offerNoGps: waited };
  return { ok: true };
}

/** Piscina escolhida antes de nadar (guardada como preferência do aluno). `open`: mar, lago, sem piscina. */
export type PoolChoice = { kind: 'pool'; m: number } | { kind: 'open' };
export const POOL_PRESETS = [25, 50] as const;
export const POOL_MIN_M = 10;
export const POOL_MAX_M = 100;

/** "33,3" / "25" → metros (uma casa); fora de 10 a 100 m é engano de digitação. */
export function parsePoolLength(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'));
  if (!text.trim() || !Number.isFinite(v)) return null;
  const m = Math.round(v * 10) / 10;
  return m >= POOL_MIN_M && m <= POOL_MAX_M ? m : null;
}

export function isPoolChoice(v: unknown): v is PoolChoice {
  if (!v || typeof v !== 'object') return false;
  const o = v as { kind?: unknown; m?: unknown };
  return o.kind === 'open' || (o.kind === 'pool' && typeof o.m === 'number' && o.m >= POOL_MIN_M && o.m <= POOL_MAX_M);
}

/** Piscinas nadadas (digitadas no fim) × tamanho da piscina; águas abertas não têm como medir. */
export function swimDistance(pool: PoolChoice | null, lengths: number): number {
  if (!pool || pool.kind !== 'pool' || !Number.isFinite(lengths) || lengths <= 0) return 0;
  return Math.round(pool.m * Math.floor(lengths) * 10) / 10;
}

/** Sem GPS, intervalo maior que isto com o app fechado não conta como treino (esqueceu de finalizar). */
export const MAX_UNTRACKED_GAP_MS = 30 * 60_000;

/**
 * Tempo (ms) ao retomar um rascunho. Gravando quando foi guardado (`live`): o treino seguiu enquanto o app
 * estava fechado, então soma o intervalo até `until`. Com GPS, `until` é o último ponto recebido em segundo
 * plano (prova de que o treino seguia). Sem GPS não há prova: soma só até 30 min; passou disso, volta com o
 * tempo guardado (o aluno esqueceu de finalizar e não ganha horas de treino a mais). Pausado: o tempo guardado.
 */
export function restoredBanked(d: { banked: number; savedAt: number; live?: boolean }, until: number, gps: boolean): number {
  if (!d.live) return d.banked;
  const gap = Math.max(0, until - d.savedAt);
  if (!gps && gap > MAX_UNTRACKED_GAP_MS) return d.banked;
  return d.banked + gap;
}

/** Resumo da tela bloqueada: com GPS, tempo, distância e ritmo (ou velocidade); sem GPS, quando começou. */
export function liveSummary(p: { sport: string; paused: boolean; elapsedS: number; gps: boolean; distanceM: number; speed: boolean; startedAt: number }): { title: string; body: string } {
  const title = i18n.t(p.paused ? 'fitness:live.titlePaused' : 'fitness:live.titleRunning', { sport: p.sport });
  const start = new Date(p.startedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (!p.gps) return { title, body: i18n.t('fitness:live.bodyTimer', { time: start }) };
  const rate = p.speed
    ? `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p.elapsedS > 0 ? (p.distanceM / p.elapsedS) * 3.6 : 0)} km/h`
    : `${formatPace(averagePace(p, p.elapsedS))} /km`;
  return { title, body: `${formatClock(p.elapsedS)} · ${formatKm(p.distanceM)} km · ${rate}` };
}
