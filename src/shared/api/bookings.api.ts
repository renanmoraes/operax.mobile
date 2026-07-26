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
};

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
