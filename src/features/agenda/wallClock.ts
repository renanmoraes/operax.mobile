/**
 * A agenda do Operax guarda e entrega todo horário como relógio de parede da unidade com sufixo `Z`:
 * `2026-07-20T15:00:00.000Z` quer dizer "15:00 na clínica", não 15:00 UTC. Por isso o app lê as partes direto do texto
 * (nunca por `new Date(...).getHours()`, que converteria pelo fuso do aparelho e deslocaria tudo) e monta os horários
 * que envia do mesmo jeito.
 */
export type WallParts = { year: number; month: number; day: number; hours: number; minutes: number };

const RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

export function wallParts(iso: string | null | undefined): WallParts | null {
  const m = RE.exec(iso ?? '');
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hours: Number(m[4] ?? 0), minutes: Number(m[5] ?? 0) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutos desde a meia-noite, no relógio da unidade. */
export function wallMinutes(iso: string): number {
  const p = wallParts(iso);
  return p ? p.hours * 60 + p.minutes : 0;
}

/** `AAAA-MM-DD` do horário. */
export function wallDateKey(iso: string): string {
  const p = wallParts(iso);
  return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : '';
}

/** `HH:mm` do horário. */
export function wallClock(iso: string): string {
  const p = wallParts(iso);
  return p ? `${pad(p.hours)}:${pad(p.minutes)}` : '';
}

/** Dia e hora escolhidos viram o texto que o servidor espera. */
export function wallIso(dateKey: string, hhmm: string): string {
  return `${dateKey}T${hhmm}:00.000Z`;
}

/** Dia do relógio do aparelho como `AAAA-MM-DD` (o aparelho está na mesma hora da unidade). */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Agora" como minutos do dia no relógio do aparelho. */
export const localMinutes = (d: Date = new Date()) => d.getHours() * 60 + d.getMinutes();

/** Soma dias a um `AAAA-MM-DD`, sem passar por fuso. */
export function addDaysKey(dateKey: string, days: number): string {
  const p = wallParts(dateKey);
  if (!p) return dateKey;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Data por extenso de um `AAAA-MM-DD` ou horário de parede (sem deslocar o dia). */
export function wallDateLabel(isoOrKey: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long' }): string {
  const p = wallParts(isoOrKey);
  if (!p) return '';
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
}

/** Duração entre dois horários de parede, em minutos. */
export function wallDuration(startIso: string, endIso: string): number {
  const a = wallParts(startIso);
  const b = wallParts(endIso);
  if (!a || !b) return 0;
  return (Date.UTC(b.year, b.month - 1, b.day, b.hours, b.minutes) - Date.UTC(a.year, a.month - 1, a.day, a.hours, a.minutes)) / 60_000;
}
