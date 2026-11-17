import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/features/auth/AuthContext';
import {
  portalCards,
  portalExam,
  portalExams,
  portalHome,
  portalPayments,
  portalProfile,
  portalReminders,
  portalServiceOrder,
  type PortalHome,
} from '@/src/shared/api/portal.api';

/**
 * O portal do cliente só existe com login real (o demonstrativo não tem essas rotas). A chave leva a empresa ativa:
 * trocar de empresa nunca mostra o que era da outra.
 */
export function usePortalScope() {
  const { mode, user } = useAuth();
  const live = mode === 'live' && user?.kind === 'client';
  const tenant = user?.kind === 'client' ? user.active_tenant_id : null;
  return { live, tenant, enabled: live && !!tenant };
}

export function usePortalHome() {
  const { tenant, enabled } = usePortalScope();
  return useQuery({ queryKey: ['portal', tenant, 'home'], queryFn: portalHome, enabled, staleTime: 20_000 });
}

/** Atualiza a tela inicial do portal (selos e listas) depois de uma ação. */
export function useRefreshPortalHome() {
  const qc = useQueryClient();
  const { tenant } = usePortalScope();
  return () => qc.invalidateQueries({ queryKey: ['portal', tenant, 'home'] });
}

function usePortalQuery<T>(key: string, fn: () => Promise<T>, extra?: unknown) {
  const { tenant, enabled } = usePortalScope();
  return useQuery({ queryKey: ['portal', tenant, key, extra ?? null], queryFn: fn, enabled, retry: false });
}

export const usePortalServiceOrder = (id: string) => usePortalQuery(`service-order`, () => portalServiceOrder(id), id);
export const usePortalPayments = () => usePortalQuery('payments', portalPayments);
export const usePortalExams = () => usePortalQuery('exams', portalExams);
export const usePortalExam = (id: string) => usePortalQuery('exam', () => portalExam(id), id);
export const usePortalReminders = () => usePortalQuery('reminders', portalReminders);
export const usePortalCards = () => usePortalQuery('cards', portalCards);
export const usePortalProfile = () => usePortalQuery('profile', portalProfile);

/** O que a tela inicial e o perfil mostram do portal: atalhos com selo, só do que a empresa usa. */
export type PortalShortcut = { key: 'services' | 'payments' | 'exams' | 'reminders' | 'card' | 'documents'; href: string; badge: number; sub: string };

export function summarize(home: PortalHome | undefined, t: (key: string, o?: Record<string, unknown>) => string): PortalShortcut[] {
  if (!home) return [];
  const c = home.capabilities;
  const orders = home.service_orders ?? [];
  const awaiting = orders.filter((o) => o.can_respond || o.can_approve).length;
  const out: PortalShortcut[] = [];
  if (c.service_orders) out.push({ key: 'services', href: '/cliente/servicos', badge: awaiting, sub: awaiting ? t('portal:hub.servicesAwaiting', { count: awaiting }) : t('portal:hub.servicesCount', { count: orders.length }) });
  if (c.payments) out.push({ key: 'payments', href: '/cliente/pagamentos', badge: home.badges.payments ?? 0, sub: home.badges.payments ? t('portal:hub.paymentsDue', { count: home.badges.payments }) : t('portal:hub.paymentsOk') });
  if (c.exams) out.push({ key: 'exams', href: '/cliente/exames', badge: home.badges.exams ?? 0, sub: home.badges.exams ? t('portal:hub.examsNew', { count: home.badges.exams }) : t('portal:hub.examsSub') });
  if (c.reminders) out.push({ key: 'reminders', href: '/cliente/avisos', badge: home.badges.reminders ?? 0, sub: home.badges.reminders ? t('portal:hub.remindersCount', { count: home.badges.reminders }) : t('portal:hub.remindersNone') });
  if (c.member_card && home.member_card) out.push({ key: 'card', href: '/cliente/carteirinha', badge: 0, sub: home.member_card.dependentes ? t('portal:hub.cardWithDependents', { count: home.member_card.dependentes }) : (home.member_card.plano ?? t('portal:hub.cardView')) });
  if (c.documents) {
    const n = (home.documents ?? []).filter((d) => d.kind !== 'fiscal' || c.fiscal).length;
    out.push({ key: 'documents', href: '/cliente/documentos', badge: 0, sub: n ? t('portal:hub.documentsCount', { count: n }) : t('portal:hub.documentsNone') });
  }
  return out;
}

export function usePortalShortcuts(t: (key: string, o?: Record<string, unknown>) => string) {
  const { data } = usePortalHome();
  return useMemo(() => summarize(data, t), [data, t]);
}
