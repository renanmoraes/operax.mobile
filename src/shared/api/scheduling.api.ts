import { api } from './client';

/**
 * Agendar pela agenda da equipe (mesmos endereços do Operax web): quem atender, profissional, serviço, horário livre,
 * forma de pagamento e as opções de lembrete e fila de espera. Horários de agenda são "relógio de parede" com `Z`
 * (ver `features/agenda/wallClock.ts`).
 */

export type SchedulingProvider = { id: string; name: string; user_id: string | null; is_active?: boolean; title?: string | null; specialty?: string | null };
export type SchedulingService = { id: string; name: string; default_duration_min: number; is_active?: boolean; internal_only?: boolean };
export type SchedulingPerson = { contact_id: string | null; client_id: string | null; name: string; phone_e164: string | null };
export type SchedulingClient = { id: string; name: string; phone_e164: string | null; contact_id: string | null };
export type PlanOption = { id: string; name: string };
export type SchedulingStatus = { waitlist_enabled: boolean; waitlist_mode: 'manual' | 'auto'; first_free_slot_only: boolean };
export type FreeSlot = { provider_id: string; starts_at: string; ends_at: string };

async function allPages<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await api.get(url, { params: { page, limit: 100 } });
    const items = (Array.isArray(data) ? data : (data?.data ?? data?.items ?? [])) as T[];
    out.push(...items);
    const total = Number(data?.total ?? items.length);
    if (Array.isArray(data) || out.length >= total || items.length === 0) break;
  }
  return out;
}

export const listSchedulingProviders = () => allPages<SchedulingProvider>('/api/scheduling/providers');
export const listSchedulingServices = () => allPages<SchedulingService>('/api/scheduling/services');

/** Serviços que este profissional realiza (vínculos ativos). */
export async function listProviderServiceIds(providerId: string): Promise<string[]> {
  const { data } = await api.get('/api/scheduling/provider-services', { params: { providerId } });
  const rows = (Array.isArray(data) ? data : (data?.data ?? data?.items ?? [])) as { service_id: string; is_active?: boolean }[];
  return rows.filter((r) => r.is_active !== false).map((r) => r.service_id);
}

/** Quem pode ser atendido: contatos (cadastro único) e clientes de agenda. */
export async function searchSchedulingPeople(search: string, limit = 30): Promise<SchedulingPerson[]> {
  const { data } = await api.get('/api/scheduling/clients/people', { params: { page: 1, limit, search: search.trim() || undefined } });
  return (Array.isArray(data) ? data : (data?.items ?? [])) as SchedulingPerson[];
}

export async function createSchedulingClient(input: { name: string; phone_e164?: string }): Promise<SchedulingClient> {
  const { data } = await api.post('/api/scheduling/clients', input);
  return data as SchedulingClient;
}

/** Convênios ativos para escolher no agendamento. */
export async function listActivePlans(): Promise<PlanOption[]> {
  const { data } = await api.get('/api/scheduling/plan-types/options/active');
  return (Array.isArray(data) ? data : (data?.data ?? [])) as PlanOption[];
}

export async function getSchedulingStatus(): Promise<SchedulingStatus> {
  const { data } = await api.get('/api/scheduling/status');
  return data as SchedulingStatus;
}

/** Horários livres do dia (`AAAA-MM-DD`) para o profissional e o serviço; o servidor já tira bloqueios, ocupados e antecedência mínima. */
export async function searchDaySlots(p: { service_id: string; provider_id: string; dateKey: string }): Promise<FreeSlot[]> {
  const { data } = await api.post('/api/scheduling/slots/search', {
    service_id: p.service_id,
    provider_id: p.provider_id,
    from: `${p.dateKey}T00:00:00.000Z`,
    to: `${p.dateKey}T23:59:59.999Z`,
  });
  if (Array.isArray(data)) return data as FreeSlot[];
  const out: FreeSlot[] = [];
  for (const slot of data?.slots ?? []) {
    for (const prov of slot.providers ?? []) {
      if (prov.provider_id !== p.provider_id) continue;
      out.push({ provider_id: prov.provider_id, starts_at: slot.starts_at, ends_at: prov.ends_at });
    }
  }
  return out;
}

export type CreateBookingInput = {
  provider_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  client_id?: string;
  client_name?: string;
  contact_id?: string;
  customer_note?: string;
  reminder_offsets_minutes?: number[];
  payment_type?: 'private' | 'insurance';
  plan_type_id?: string;
  join_waitlist?: boolean;
  waitlist_period?: 'any' | 'morning' | 'afternoon';
  allow_blocked_overlap?: boolean;
  allow_booking_overlap?: boolean;
  encaixe_justification?: string;
  force_no_show_override?: boolean;
  force_single_booking_override?: boolean;
};

export type CreatedBooking = { id: string; starts_at: string; waitlist_error?: string };

export async function createSchedulingBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const { data } = await api.post('/api/scheduling/bookings', input);
  return data as CreatedBooking;
}
