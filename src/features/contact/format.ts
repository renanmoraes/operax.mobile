import { locale } from '@/src/i18n';

/** Centavos em reais, no idioma do app. */
export const brl = (cents: number): string => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BRL' }).format(cents / 100);

/** Dia `AAAA-MM-DD` (ou ISO) como data curta. Lê o texto: não converte pelo fuso do aparelho. */
export function dayLabel(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m) return '';
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Data e hora de um instante real (criação de nota, recebimento), no fuso do aparelho. */
export function stampLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** `AAAA-MM-DD` → `dd/mm/aaaa` (campo de data digitado). */
export function ymdToBr(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Idade em anos completos a partir de `AAAA-MM-DD`. */
export function ageOf(ymd: string | null | undefined, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m) return null;
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age -= 1;
  return age >= 0 ? age : null;
}
