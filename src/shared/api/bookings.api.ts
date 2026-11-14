import { api } from './client';
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
  payment_type?: 'private' | 'insurance' | null;
  plan_type_name?: string | null;
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
export async function runBookingAction(id: string, action: BookingAction, opts?: { reason?: string; payment_type?: 'private' | 'insurance' }) {
  const reason = opts?.reason?.trim() || undefined;
  const path =
    action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : action === 'check_in' ? 'check-in' : action === 'no_show' ? 'no-show' : 'cancel';
  const body =
    action === 'check_in'
      ? opts?.payment_type
        ? { payment_type: opts.payment_type }
        : {}
      : action === 'reject'
        ? { reason, notify_client: true }
        : reason
          ? { reason }
          : undefined;
  const { data } = await api.post(`/api/scheduling/bookings/${id}/${path}`, body);
  return data as ApiBooking;
}

export type BookingsResult =
  | { ok: true; items: ApiBooking[]; total: number }
  | { ok: false; code: 'plan_locked' | 'error'; message: string };

export async function listBookings(params?: {
  from?: string;
  to?: string;
  limit?: number;
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
        message:
          (err.response.data as { message?: string })?.message ||
          'Agenda não inclusa no plano deste tenant.',
      };
    }
    return {
      ok: false,
      code: 'error',
      message: 'Não foi possível carregar a agenda.',
    };
  }
}
