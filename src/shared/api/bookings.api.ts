import { api } from './client';
import i18n from '@/src/i18n';
import { isAxiosError } from 'axios';

export type ApiBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  provider_name?: string | null;
  client_name?: string | null;
  service_name?: string | null;
  location_name?: string | null;
  /** Detalhes que a ficha do agendamento mostra (mesmos campos do Operax web). */
  client_contact_id?: string | null;
  client_phone_e164?: string | null;
  provider_id?: string;
  service_id?: string;
  client_id?: string | null;
  payment_type?: 'private' | 'insurance' | null;
  plan_type_id?: string | null;
  plan_type_name?: string | null;
  /** Situação como o servidor grava (a agenda normaliza `status` para as cores e os rótulos). */
  raw_status?: string;
  visit_kind?: 'primeira_consulta' | 'retorno' | null;
  is_encaixe?: boolean;
  encaixe_justification?: string | null;
  sem_lembrete?: boolean;
  sem_lembrete_motivo?: string | null;
  staff_notes?: string | null;
  customer_note?: string | null;
  reminder_offsets_minutes?: number[];
  series_id?: string | null;
  occurrence_index?: number | null;
  last_reschedule_reason?: string | null;
  requested_by_contact_name?: string | null;
  created_at?: string;
};

export type BookingAction = 'approve' | 'reject' | 'check_in' | 'no_show' | 'cancel';

/** Ações da ficha do agendamento. Dar entrada sem forma de pagamento registrada pede `payment_type`. */
export type BookingPayment = { payment_type: 'private' | 'insurance'; plan_type_id?: string | null };

export async function runBookingAction(id: string, action: BookingAction, opts?: { reason?: string; payment_type?: 'private' | 'insurance'; plan_type_id?: string | null; notify_client?: boolean }) {
  const reason = opts?.reason?.trim() || undefined;
  const path =
    action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : action === 'check_in' ? 'check-in' : action === 'no_show' ? 'no-show' : 'cancel';
  const body =
    action === 'check_in'
      ? opts?.payment_type
        ? { payment_type: opts.payment_type, ...(opts.payment_type === 'insurance' && opts.plan_type_id ? { plan_type_id: opts.plan_type_id } : {}) }
        : {}
      : action === 'reject'
        ? { reason, notify_client: opts?.notify_client ?? true }
        : reason
          ? { reason }
          : undefined;
  const { data } = await api.post(`/api/scheduling/bookings/${id}/${path}`, body);
  return data as ApiBooking;
}

/** Corrige particular/convênio de um agendamento ainda aberto. */
export async function updateBookingPayment(id: string, payment: BookingPayment) {
  const { data } = await api.patch(`/api/scheduling/bookings/${id}/payment`, payment);
  return data as ApiBooking;
}

export type RescheduleInput = {
  starts_at: string;
  ends_at: string;
  reason: string;
  provider_id?: string;
  service_id?: string;
  allow_blocked_overlap?: boolean;
  allow_booking_overlap?: boolean;
  encaixe_justification?: string;
};

/** Remarca no mesmo registro. `whatsapp_notice` diz se o cliente foi avisado. */
export async function rescheduleBooking(id: string, input: RescheduleInput) {
  const { data } = await api.post(`/api/scheduling/bookings/${id}/reschedule`, input);
  return data as ApiBooking & { whatsapp_notice?: { sent: boolean; channel: 'template' | 'text' | null; skip_reason: string | null } };
}

export async function getBooking(id: string) {
  const { data } = await api.get(`/api/scheduling/bookings/${id}`);
  return data as ApiBooking;
}

export type BookingsResult =
  | { ok: true; items: ApiBooking[]; total: number }
  | { ok: false; code: 'plan_locked' | 'error'; message: string };

/**
 * Todos os agendamentos do período, página por página (o backend devolve no máximo 200 por vez).
 * A agenda pede de ontem a amanhã e filtra o dia local: com uma página só, os de ontem podiam
 * empurrar os de hoje para fora da resposta.
 */
export async function listAllBookings(params: { from: string; to: string }): Promise<BookingsResult> {
  const PAGE = 200;
  const items: ApiBooking[] = [];
  for (let page = 0; page < 20; page++) {
    const r = await listBookings({ ...params, limit: PAGE, offset: page * PAGE });
    if (!r.ok) return r;
    items.push(...r.items);
    if (r.items.length < PAGE || items.length >= r.total) break;
  }
  return { ok: true, items, total: items.length };
}

export async function listBookings(params?: {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<BookingsResult> {
  try {
    const { data } = await api.get('/api/scheduling/bookings', { params });
    const items = (data?.items ?? data?.data ?? (Array.isArray(data) ? data : [])) as ApiBooking[];
    return { ok: true, items, total: data?.total ?? items.length };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 403) {
      return {
        ok: false,
        code: 'plan_locked',
        // Sempre o texto traduzido: o 403 do servidor pode vir em inglês ("Forbidden resource").
        message: i18n.t('errors.agendaLocked'),
      };
    }
    return {
      ok: false,
      code: 'error',
      message: i18n.t('errors.agendaLoad'),
    };
  }
}
