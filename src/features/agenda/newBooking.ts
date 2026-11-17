import type { CreateBookingInput, SchedulingPerson, SchedulingProvider, SchedulingService } from '@/src/shared/api/scheduling.api';
import { localDateKey, localMinutes, wallClock, wallDateKey, wallDuration, wallIso, wallMinutes } from './wallClock';

/** Antecedências de lembrete que o app oferece (minutos). O padrão da empresa é 1 dia antes. */
export const REMINDER_CHOICES = [10_080, 2_880, 1_440, 120, 60] as const;
export const DEFAULT_REMINDERS: number[] = [1_440];

export type PaymentChoice = { type: 'none' | 'private' | 'insurance'; planId: string };
export const NO_PAYMENT: PaymentChoice = { type: 'none', planId: '' };

/** Convênio só vale com o plano escolhido; os outros não levam plano. */
export const paymentComplete = (p: PaymentChoice) => p.type !== 'insurance' || p.planId.trim().length > 0;

export function paymentPayload(p: PaymentChoice): Pick<CreateBookingInput, 'payment_type' | 'plan_type_id'> {
  if (p.type === 'insurance') return { payment_type: 'insurance', plan_type_id: p.planId };
  if (p.type === 'private') return { payment_type: 'private' };
  return {};
}

/** Celular digitado → E.164 do Brasil (+55). Menos de 10 dígitos não vale. */
export function phoneToE164(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (!d) return null;
  const national = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  return national.length === 10 || national.length === 11 ? `+55${national}` : null;
}

/** Quem tem só `scheduling:create_own` marca só no próprio nome: o profissional é o do seu usuário. */
export function ownProvider(providers: SchedulingProvider[], userId: string | undefined, canCreateAny: boolean): SchedulingProvider | null {
  if (canCreateAny) return null;
  return providers.find((p) => p.user_id === userId) ?? (providers.length === 1 ? providers[0] : null);
}

/** Serviços que o profissional realiza; sem vínculos informados, nenhum (o servidor recusaria). */
export function servicesOf(allowed: string[] | undefined, services: SchedulingService[]): SchedulingService[] {
  if (!allowed) return [];
  return services.filter((s) => s.is_active !== false && allowed.includes(s.id));
}

/** Só horários de hoje que ainda não passaram; dias futuros ficam como o servidor mandou. */
export function upcoming<T extends { starts_at: string }>(slots: T[], now: Date = new Date()): T[] {
  const today = localDateKey(now);
  const minNow = localMinutes(now);
  return slots
    .filter((s) => {
      const key = wallDateKey(s.starts_at);
      return key > today || (key === today && wallMinutes(s.starts_at) >= minNow);
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Pessoa escolhida → o que o servidor aceita para identificar quem será atendido. */
export function clientPayload(person: Pick<SchedulingPerson, 'client_id' | 'contact_id' | 'name'>): Pick<CreateBookingInput, 'client_id' | 'contact_id' | 'client_name'> {
  if (person.client_id) return { client_id: person.client_id };
  if (person.contact_id) return { contact_id: person.contact_id, client_name: person.name };
  return { client_name: person.name };
}

/** Horário digitado à mão (encaixe): `HH:mm` válido, com fim = início + duração do serviço. */
export function manualRange(dateKey: string, hhmm: string, durationMin: number): { starts_at: string; ends_at: string } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  const start = `${String(m[1]).padStart(2, '0')}:${m[2]}`;
  const startsAt = wallIso(dateKey, start);
  const endMin = Number(m[1]) * 60 + Number(m[2]) + durationMin;
  if (endMin >= 24 * 60) return null;
  const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  return { starts_at: startsAt, ends_at: wallIso(dateKey, end) };
}

export const encaixeJustificationOk = (s: string) => s.trim().length >= 5;

/** Texto do servidor, só quando é um aviso (4xx) escrito. */
export function serverMessage(e: unknown): { status: number; message: string | null; code: string | null; data: unknown } {
  const res = (e as { response?: { status?: number; data?: { message?: string | string[]; code?: string } } })?.response;
  const raw = Array.isArray(res?.data?.message) ? res?.data?.message[0] : res?.data?.message;
  return { status: res?.status ?? 0, message: typeof raw === 'string' && raw.trim() ? raw : null, code: res?.data?.code ?? null, data: res?.data };
}

export type BookingFailure =
  | { kind: 'single_active'; message: string; when: string | null }
  | { kind: 'no_show'; message: string }
  | { kind: 'soft_block'; message: string }
  | { kind: 'other'; message: string | null };

/** O que a resposta de erro do servidor pede de quem está marcando. */
export function classifyFailure(e: unknown): BookingFailure {
  const { status, message, code, data } = serverMessage(e);
  if (status === 409 && code === 'single_active_booking') {
    const b = (data as { booking?: { starts_at?: string } } | undefined)?.booking;
    return { kind: 'single_active', message: message ?? '', when: b?.starts_at ?? null };
  }
  if (status === 403 && message && /pol[ií]tica de falta/i.test(message)) return { kind: 'no_show', message };
  if (status === 409 && message && /dentro de um bloqueio\. Confirme/i.test(message)) return { kind: 'soft_block', message };
  return { kind: 'other', message: status >= 400 && status < 500 ? message : null };
}

/** Duração em minutos do horário escolhido (a do serviço quando o servidor não devolveu o fim). */
export const slotDuration = (startsAt: string, endsAt: string, fallback: number) => wallDuration(startsAt, endsAt) || fallback;

/** Rótulo curto do horário (`09:30`). */
export const slotLabel = wallClock;
