import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showDialog } from '@/src/design-system/Dialog';
import { useIsFocused } from 'expo-router';
import { isAxiosError } from 'axios';
import i18n from '@/src/i18n';
import * as api from './clientApi';
import { clientDataMode } from './dataMode';
import { UserFacingError } from './userFacingError';
import { useAuth } from '@/src/features/auth/AuthContext';
import type { ChatMessage, ClientBooking, OutgoingAttachment } from './types';
import { useEffect } from 'react';
import { describe, notifyNow, syncBookingReminders } from '@/src/features/notifications/reminders';

const keys = {
  companies: ['client', 'companies'] as const,
  bookings: ['client', 'bookings'] as const,
  chats: ['client', 'chats'] as const,
  thread: (slug: string | undefined) => ['client', 'chat-thread', slug] as const,
};

export function useCompanies(opts?: { enabled?: boolean }) {
  return useQuery({ queryKey: keys.companies, queryFn: api.fetchCompanies, enabled: opts?.enabled ?? true });
}

export type ClientCapabilities = { scheduling: boolean; chat: boolean; training: boolean };

/**
 * O que a empresa ativa liberou no portal (agenda, chat, treino). É o "controle de permissão" do
 * lado do cliente: o que a empresa não liberou nem aparece. Enquanto carrega, treino fica escondido
 * (para a aba não aparecer e sumir em seguida).
 */
export function useClientCapabilities(): ClientCapabilities & { loaded: boolean } {
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const client = user?.kind === 'client' ? user : null;
  const active = client?.memberships.find((m) => m.tenant_id === client.active_tenant_id);
  const company = companies?.find((c) => (active?.tenant_slug ? c.slug === active.tenant_slug : c.name === active?.tenant_name));
  if (!company) return { scheduling: true, chat: true, training: false, loaded: !!companies };
  return { ...company.capabilities, loaded: true };
}

/** Endereço (slug) da empresa ativa, para abrir o chat dela. */
export function useActiveCompanySlug(): string {
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const client = user?.kind === 'client' ? user : null;
  const active = client?.memberships.find((m) => m.tenant_id === client.active_tenant_id);
  return active?.tenant_slug ?? companies?.find((c) => c.name === active?.tenant_name)?.slug ?? companies?.[0]?.slug ?? 'empresa';
}

export function useBookings() {
  return useQuery({ queryKey: keys.bookings, queryFn: api.fetchBookings });
}

export function useBooking(id: string | undefined) {
  const q = useBookings();
  return { ...q, data: q.data?.find((b) => b.id === id) };
}

/** Texto para o aviso quando uma ação falha: a regra que o portal explicou, ou um pedido para tentar de novo. */
export function actionErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const msg = (e.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof msg === 'string' && msg.trim() && (e.response?.status ?? 500) < 500) return msg;
    return i18n.t('client:errors.actionOffline');
  }
  return e instanceof UserFacingError && e.message ? e.message : i18n.t('client:errors.action');
}

function useBookingMutation<A>(fn: (arg: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookings }),
    onError: (e) => void showDialog({ title: i18n.t('client:errors.title'), message: actionErrorMessage(e), tone: 'warn' }),
  });
}

/** Desfazer confirmação ou resposta de vaga só existe no modo demonstração (o portal não tem essa volta). */
export const canUndoBookingAnswer = () => clientDataMode() !== 'live';

export const useConfirmBooking = () => useBookingMutation((id: string) => api.confirmBooking(id));
export const useUnconfirmBooking = () => useBookingMutation((id: string) => api.unconfirmBooking(id));
export const useCancelBooking = () =>
  useBookingMutation(({ id, reason }: { id: string; reason: string }) => api.cancelBooking(id, reason));
export function useClassAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'reset' }) => api.changeClassBooking(id, action),
    onSuccess: (_d, vars) => {
      // Inscreveu-se na aula: aviso na hora (os lembretes antes da aula vêm do sync da agenda).
      if (vars.action === 'accept') {
        const b = qc.getQueryData<ClientBooking[]>(keys.bookings)?.find((x) => x.id === vars.id);
        if (b) void notifyNow(i18n.t('client:reminders.classEnrolled'), describe(b, new Date(b.starts_at), new Date()), `/cliente/aula/${b.id}`);
      }
      return qc.invalidateQueries({ queryKey: keys.bookings });
    },
    onError: (e) => void showDialog({ title: i18n.t('client:errors.title'), message: actionErrorMessage(e), tone: 'warn' }),
  });
}

/** Mantém os lembretes do aparelho iguais à agenda (só com login real e agenda liberada). */
export function useBookingReminders() {
  const caps = useClientCapabilities();
  const { data } = useBookings();
  useEffect(() => {
    if (!data || clientDataMode() !== 'live' || !caps.scheduling) return;
    void syncBookingReminders(data);
  }, [data, caps.scheduling]);
}

export function useChats() {
  // Login real: o selo de não lidas acompanha a resposta da equipe sem precisar abrir nada.
  return useQuery({ queryKey: keys.chats, queryFn: api.fetchChats, refetchInterval: () => (clientDataMode() === 'live' ? 10_000 : false) });
}

/** A conversa aberta. No portal real, buscá-la já marca como lida. */
export function useChat(slug: string | undefined) {
  const qc = useQueryClient();
  // Só busca com a conversa na tela: abrir uma foto por cima ou trocar de aba para tudo, senão o
  // portal marcaria como lida a mensagem que a pessoa não viu.
  const focused = useIsFocused();
  return useQuery({
    queryKey: keys.thread(slug),
    enabled: !!slug && focused,
    // Conversa aberta com o login real: o portal não tem tempo real, então busca a cada 3 s (só com o
    // app na frente; em segundo plano para, e a mensagem não é marcada como lida sem a pessoa ver).
    refetchInterval: () => (clientDataMode() === 'live' && focused ? 3_000 : false),
    queryFn: async () => {
      const chat = await api.fetchChatThread(slug!);
      // Abrir/atualizar já zera as não lidas no portal: atualiza a lista e o selo se ainda mostram alguma.
      const listed = qc.getQueryData<{ unread: number }[]>(keys.chats);
      if (clientDataMode() === 'live' && listed?.some((c) => c.unread > 0)) void qc.invalidateQueries({ queryKey: keys.chats });
      return chat ?? null;
    },
  });
}

export function useClientUnread() {
  const { data } = useChats();
  return data?.reduce((n, c) => n + c.unread, 0) ?? 0;
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.markChatRead, onSuccess: () => qc.invalidateQueries({ queryKey: keys.chats }) });
}

export function useSendChat(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; attachment?: OutgoingAttachment; reschedule?: ChatMessage['reschedule'] }) =>
      api.sendChatMessage(slug, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.chats });
      void qc.invalidateQueries({ queryKey: keys.thread(slug) });
    },
  });
}
