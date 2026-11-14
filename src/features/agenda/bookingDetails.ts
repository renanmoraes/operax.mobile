import type { ApiBooking, BookingAction } from '@/src/shared/api/bookings.api';

/** Ficha do agendamento como a tela mostra (igual ao que o Operax web traz ao abrir na agenda). */
export type BookingDetails = {
  id: string;
  client: string;
  status: string;
  provider: string | null;
  service: string | null;
  location: string | null;
  phone: string | null;
  contactId: string | null;
  payment: string | null;
  paymentKnown: boolean;
  visit: 'Retorno' | 'Nova consulta' | null;
  encaixe: string | null;
  semLembrete: string | null;
  staffNotes: string | null;
  customerNote: string | null;
  reminders: string[];
  series: string | null;
  rescheduleReason: string | null;
  requestedBy: string | null;
};

/** "Particular", "Convênio Unimed", "Convênio" ou nada (recepção ainda não informou). */
export function paymentSummary(type?: string | null, planName?: string | null): string | null {
  if (type === 'private') return 'Particular';
  if (type === 'insurance') return planName ? `Convênio ${planName}` : 'Convênio';
  return null;
}

/** Lembrete em linguagem simples: 1440 → "1 dia antes", 120 → "2 h antes", 30 → "30 min antes". */
export function reminderLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? 'dia' : 'dias'} antes`;
  if (minutes % 60 === 0) return `${minutes / 60} h antes`;
  return `${minutes} min antes`;
}

/** Telefone E.164 brasileiro para leitura: +5511987654321 → (11) 98765-4321. */
export function phoneLabel(e164?: string | null): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function detailsFromApi(b: ApiBooking): BookingDetails {
  return {
    id: b.id,
    client: b.client_name || 'Cliente',
    status: String(b.status).toLowerCase(),
    provider: b.provider_name ?? null,
    service: b.service_name ?? null,
    location: b.location_name ?? null,
    phone: b.client_phone_e164 ?? null,
    contactId: b.client_contact_id ?? null,
    payment: paymentSummary(b.payment_type, b.plan_type_name),
    paymentKnown: b.payment_type === 'private' || b.payment_type === 'insurance',
    visit: b.visit_kind === 'retorno' ? 'Retorno' : b.visit_kind === 'primeira_consulta' ? 'Nova consulta' : null,
    encaixe: b.is_encaixe || b.encaixe_justification ? b.encaixe_justification?.trim() || 'Horário sobreposto autorizado pela recepção.' : null,
    semLembrete: b.sem_lembrete ? (b.sem_lembrete_motivo?.trim() ? `Ninguém vai ser avisado antes do horário: ${b.sem_lembrete_motivo.trim()}.` : 'Ninguém vai ser avisado antes do horário.') : null,
    staffNotes: b.staff_notes?.trim() || null,
    customerNote: b.customer_note?.trim() || null,
    reminders: (b.reminder_offsets_minutes ?? []).slice().sort((x, y) => y - x).map(reminderLabel),
    series: b.series_id ? (b.occurrence_index ? `Faz parte de uma série recorrente (ocorrência ${b.occurrence_index})` : 'Faz parte de uma série recorrente') : null,
    rescheduleReason: b.last_reschedule_reason?.trim() || null,
    requestedBy: b.requested_by_contact_name?.trim() || null,
  };
}

/**
 * Ações que fazem sentido em cada situação (como no web): pedido aguardando → aprovar/recusar;
 * confirmado → dar entrada, falta e cancelar. Encerrados não têm ação.
 */
/**
 * Status do backend → os nomes que a agenda do app usa. O banco grava `approved`, `pending_approval`,
 * `canceled`… e as telas (cores, rótulos, ações) trabalham com confirmed/pending/cancelled.
 */
export function normalizeBookingStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'confirmado' || s === 'scheduled') return 'confirmed';
  if (s === 'pending_approval' || s === 'pendente' || s === 'requested' || s === 'reschedule_pending_manual') return 'pending';
  if (s === 'canceled' || s === 'cancelado' || s === 'late_cancelled') return 'cancelled';
  if (s === 'completed') return 'done';
  return s;
}

export function actionsFor(status: string): BookingAction[] {
  const s = status.toLowerCase();
  if (s === 'pending' || s === 'pendente' || s === 'requested') return ['approve', 'reject'];
  if (s === 'confirmed' || s === 'confirmado' || s === 'scheduled') return ['check_in', 'no_show', 'cancel'];
  return [];
}

/** Permissão de cada ação (mesmas regras das rotas de agendamento no backend). */
export const ACTION_PERM = {
  approve: 'bookingApprove',
  reject: 'bookingApprove',
  check_in: 'bookingCreate',
  no_show: 'bookingCancel',
  cancel: 'bookingCancel',
} as const satisfies Record<BookingAction, 'bookingApprove' | 'bookingCreate' | 'bookingCancel'>;

export const ACTION_LABEL: Record<BookingAction, string> = {
  approve: 'Aprovar pedido',
  reject: 'Recusar pedido',
  check_in: 'Dar entrada',
  no_show: 'Marcar falta',
  cancel: 'Cancelar agendamento',
};

/** Status depois da ação (para o modo demo e para atualizar a tela antes de recarregar). */
export const STATUS_AFTER: Record<BookingAction, string> = {
  approve: 'confirmed',
  reject: 'rejected',
  check_in: 'completed',
  no_show: 'no_show',
  cancel: 'cancelled',
};
