import i18n, { currentLang, locale } from '@/src/i18n';

const pad = (n: number) => String(n).padStart(2, '0');
/** Número com 1 casa no formato do idioma ("1,5" em português, "1.5" em inglês). */
const dec1 = (n: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
const intl = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), o).format(d);

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.round(seconds / 60);
  if (m < 100) return `${m} min`;
  return `${Math.floor(m / 60)}h ${pad(m % 60)}`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${dec1(meters / 1000)} km`;
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatKg(kg: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(Math.round(kg * 10) / 10);
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 60_000;
  if (diff < 1) return i18n.t('time.now');
  if (diff < 60) return i18n.t('time.minutesAgo', { count: Math.round(diff) });
  const h = diff / 60;
  if (h < 24) return i18n.t('time.hoursAgo', { count: Math.round(h) });
  const d = Math.round(h / 24);
  return d === 1 ? i18n.t('time.yesterday') : i18n.t('time.daysAgo', { count: d });
}

export function minutesUntilLabel(iso: string, now = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (diff <= 0) return i18n.t('time.now');
  if (diff < 60) return i18n.t('time.inMinutes', { count: diff });
  return i18n.t('time.inHoursMinutes', { h: Math.floor(diff / 60), m: pad(diff % 60) });
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Português com os nomes de sempre ("Qui", "nov"); os outros idiomas pelo Intl do aparelho.
const pt = () => currentLang() === 'pt';
export const weekdayShort = (d: Date) => (pt() ? WEEKDAYS[d.getDay()] : cap(intl(d, { weekday: 'short' }).replace('.', '')));
export const weekdayFull = (d: Date) => (pt() ? WEEKDAYS_FULL[d.getDay()] : intl(d, { weekday: 'long' }));
export const monthShort = (d: Date) => (pt() ? MONTHS[d.getMonth()] : intl(d, { month: 'short' }).replace('.', ''));
export const monthFull = (d: Date) => (pt() ? MONTHS_FULL[d.getMonth()] : intl(d, { month: 'long' }));

/** Iniciais dos dias, de segunda a domingo ("S T Q Q S S D" em português, "M T W T F S S" em inglês). */
export function weekdayInitials(): string[] {
  if (pt()) return ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  // 1º de janeiro de 2024 foi uma segunda-feira.
  return Array.from({ length: 7 }, (_, i) => intl(new Date(2024, 0, 1 + i), { weekday: 'narrow' }).toUpperCase());
}

export function formatHour(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Quinta, 19 de novembro" */
export function longDate(d: Date): string {
  if (!pt()) return cap(intl(d, { weekday: 'long', day: 'numeric', month: 'long' }));
  const w = weekdayFull(d);
  return `${w[0].toUpperCase()}${w.slice(1)}, ${d.getDate()} de ${monthFull(d)}`;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Segunda-feira da semana de `d`. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return i18n.t(h < 12 ? 'greeting.morning' : h < 18 ? 'greeting.afternoon' : 'greeting.evening');
}
