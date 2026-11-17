import i18n from '@/src/i18n';
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
  /** Particular, ou convênio já com o plano: o que dá para dar entrada sem perguntar nada (como no web). */
  paymentKnown: boolean;
  paymentType: 'private' | 'insurance' | null;
  planId: string | null;
  /** Situação como o servidor grava (pending_approval, approved, reschedule_pending_manual…). */
  rawStatus: string;
  providerId: string | null;
  serviceId: string | null;
  visit: string | null;
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
  if (type === 'private') return i18n.t('agenda:booking.payment.private');
  if (type === 'insurance') return planName ? i18n.t('agenda:booking.payment.insurance', { plan: planName }) : i18n.t('agenda:booking.payment.insuranceNoPlan');
  return null;
}

/** Lembrete em linguagem simples: 1440 → "1 dia antes", 120 → "2 h antes", 30 → "30 min antes". */
export function reminderLabel(minutes: number): string {
  if (minutes % 1440 === 0) return i18n.t('agenda:booking.reminder.days', { count: minutes / 1440 });
  if (minutes % 60 === 0) return i18n.t('agenda:booking.reminder.hours', { count: minutes / 60 });
  return i18n.t('agenda:booking.reminder.minutes', { count: minutes });
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
    client: b.client_name || i18n.t('agenda:booking.client'),
    status: String(b.status).toLowerCase(),
    provider: b.provider_name ?? null,
    service: b.service_name ?? null,
    location: b.location_name ?? null,
    phone: b.client_phone_e164 ?? null,
    contactId: b.client_contact_id ?? null,
    payment: paymentSummary(b.payment_type, b.plan_type_name),
    paymentKnown: hasKnownPayment(b.payment_type, b.plan_type_id),
    paymentType: b.payment_type ?? null,
    planId: b.plan_type_id ?? null,
    rawStatus: rawStatusOf(b.raw_status ?? b.status),
    providerId: b.provider_id ?? null,
    serviceId: b.service_id ?? null,
    visit: b.visit_kind === 'retorno' ? i18n.t('agenda:booking.visitReturn') : b.visit_kind === 'primeira_consulta' ? i18n.t('agenda:booking.visitNew') : null,
    encaixe: b.is_encaixe || b.encaixe_justification ? b.encaixe_justification?.trim() || i18n.t('agenda:booking.encaixeDefault') : null,
    semLembrete: b.sem_lembrete ? (b.sem_lembrete_motivo?.trim() ? i18n.t('agenda:booking.noReminderReason', { reason: b.sem_lembrete_motivo.trim() }) : i18n.t('agenda:booking.noReminder')) : null,
    staffNotes: b.staff_notes?.trim() || null,
    customerNote: b.customer_note?.trim() || null,
    reminders: (b.reminder_offsets_minutes ?? []).slice().sort((x, y) => y - x).map(reminderLabel),
    series: b.series_id ? (b.occurrence_index ? i18n.t('agenda:booking.seriesN', { n: b.occurrence_index }) : i18n.t('agenda:booking.series')) : null,
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

/** Particular, ou convênio com o plano escolhido. Convênio sem plano (ex.: "outro convênio" do WhatsApp) ainda não está resolvido. */
export function hasKnownPayment(type?: string | null, planId?: string | null): boolean {
  if (type === 'private') return true;
  return type === 'insurance' && !!planId;
}

/** Os nomes que a agenda usa (confirmed, pending…) de volta para o que o servidor grava. */
export function rawStatusOf(status: string): string {
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'confirmado' || s === 'scheduled') return 'approved';
  if (s === 'pending' || s === 'pendente' || s === 'requested') return 'pending_approval';
  if (s === 'canceled' || s === 'cancelado') return 'canceled';
  return s;
}

/** Enquanto o agendamento está aberto dá para corrigir o pagamento, remarcar e cancelar. */
export const OPEN_STATUSES = ['pending_approval', 'approved', 'confirmed', 'reschedule_pending_manual'];

export type ActionPerms = { create: boolean; approve: boolean; cancel: boolean };

/**
 * Ações que valem em cada situação, como no web (BookingActionButtons): pedido aguardando (pending_approval) →
 * aprovar e recusar, e dar entrada só com permissão de aprovar; aprovado ou confirmado → dar entrada, falta e cancelar;
 * remarcação pendente → só cancelar. Encerrados não têm ação. Sem `perms` não filtra por permissão.
 */
export function actionsFor(status: string, perms: ActionPerms = { create: true, approve: true, cancel: true }): BookingAction[] {
  const s = rawStatusOf(status);
  const out: BookingAction[] = [];
  const settled = s === 'approved' || s === 'confirmed';
  if ((settled && perms.create) || (s === 'pending_approval' && perms.create && perms.approve)) out.push('check_in');
  if (s === 'pending_approval' && perms.approve) out.push('approve', 'reject');
  if (settled && perms.cancel) out.push('no_show');
  if (OPEN_STATUSES.includes(s) && perms.cancel) out.push('cancel');
  return out;
}

/** Corrigir pagamento e remarcar: agendamento aberto e permissão de marcar (`create` ou `create_own`). */
export const canEditOpen = (status: string, canCreate: boolean) => canCreate && OPEN_STATUSES.includes(rawStatusOf(status));

/** Permissão de cada ação (mesmas regras das rotas de agendamento no backend). */
export const ACTION_PERM = {
  approve: 'bookingApprove',
  reject: 'bookingApprove',
  check_in: 'bookingCreate',
  no_show: 'bookingCancel',
  cancel: 'bookingCancel',
} as const satisfies Record<BookingAction, 'bookingApprove' | 'bookingCreate' | 'bookingCancel'>;

export const actionLabel = (a: BookingAction): string => i18n.t(`agenda:booking.action.${a}`);

/** Status depois da ação (para o modo demo e para atualizar a tela antes de recarregar). */
export const STATUS_AFTER: Record<BookingAction, string> = {
  approve: 'confirmed',
  reject: 'rejected',
  check_in: 'completed',
  no_show: 'no_show',
  cancel: 'cancelled',
};
