import i18n, { locale } from '@/src/i18n';
import type { PortalOrder } from '@/src/shared/api/portal.api';

export type StatusTone = 'success' | 'warn' | 'danger' | 'primary' | 'neutral';

export const centsToMoney = (cents: number) => (cents / 100).toLocaleString(locale(), { style: 'currency', currency: 'BRL' });

/** Valor do portal (texto numérico ou número). Vazio ou inválido não vira "R$ 0,00": some. */
export function money(value: string | number | null | undefined, currency: string | null = 'BRL'): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString(locale(), { style: 'currency', currency: currency || 'BRL' });
}

export const shortDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale()) : '');

/** Valor que aparece na lista: o final se houver, senão o estimado; zerado não é valor. */
export function orderAmount(o: Pick<PortalOrder, 'final_amount' | 'estimated_amount' | 'currency'>): string {
  const amount = Number(o.final_amount) > 0 ? o.final_amount : Number(o.estimated_amount) > 0 ? o.estimated_amount : null;
  return money(amount, o.currency);
}

type OrderLike = Pick<PortalOrder, 'status' | 'quote_state' | 'can_respond' | 'can_approve'>;

const BASE: Record<string, { key: string; tone: StatusTone; step: number }> = {
  draft: { key: 'draft', tone: 'neutral', step: 1 },
  pending_approval: { key: 'pending_approval', tone: 'warn', step: 2 },
  approved: { key: 'approved', tone: 'success', step: 3 },
  in_progress: { key: 'in_progress', tone: 'primary', step: 4 },
  completed: { key: 'completed', tone: 'success', step: 5 },
  cancelled: { key: 'cancelled', tone: 'danger', step: 0 },
};

/**
 * A situação do serviço do jeito que o cliente entende. O que ele fez com o orçamento vale mais que a situação
 * interna da empresa: quem aprovou não pode continuar lendo "aguardando sua aprovação". `step` é a etapa (0 a 5).
 */
export function orderStatus(o: OrderLike): { label: string; tone: StatusTone; step: number } {
  const t = (k: string) => i18n.t(`portal:services.status.${k}` as 'portal:services.status.draft');
  if (o.can_respond || o.can_approve) return { label: t('awaitingYou'), tone: 'warn', step: 2 };
  const base = BASE[o.status];
  const early = o.status === 'draft' || o.status === 'pending_approval';
  if (early && o.quote_state === 'accepted') return { label: t('youApproved'), tone: 'success', step: 3 };
  if (early && o.quote_state === 'declined') return { label: t('youDeclined'), tone: 'danger', step: 2 };
  if (early && o.quote_state === 'revising') return { label: t('revising'), tone: 'primary', step: 2 };
  if (o.status === 'pending_approval') return { label: t('analysis'), tone: 'neutral', step: 2 };
  if (!base) return { label: o.status, tone: 'neutral', step: 0 };
  return { label: t(base.key), tone: base.tone, step: base.step };
}

export const QUOTE_TONE: Record<string, StatusTone> = { awaiting: 'warn', accepted: 'success', declined: 'danger', revising: 'primary', closed: 'neutral' };
