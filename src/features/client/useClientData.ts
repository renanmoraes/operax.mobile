import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Alert } from 'react-native';
import * as api from './clientApi';
import { clientDataMode } from './dataMode';
import type { ChatMessage, OutgoingAttachment } from './types';

const keys = {
  companies: ['client', 'companies'] as const,
  bookings: ['client', 'bookings'] as const,
  chats: ['client', 'chats'] as const,
  thread: (slug: string | undefined) => ['client', 'chat-thread', slug] as const,
};

export function useCompanies(opts?: { enabled?: boolean }) {
  return useQuery({ queryKey: keys.companies, queryFn: api.fetchCompanies, enabled: opts?.enabled ?? true });
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
    return 'Não foi possível concluir agora. Confira a internet e tente de novo.';
  }
  return e instanceof Error && e.message ? e.message : 'Não foi possível concluir agora.';
}

function useBookingMutation<A>(fn: (arg: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookings }),
    onError: (e) => Alert.alert('Não deu certo', actionErrorMessage(e)),
  });
}

/** Desfazer confirmação ou resposta de vaga só existe no modo demonstração (o portal não tem essa volta). */
export const canUndoBookingAnswer = () => clientDataMode() !== 'live';

export const useConfirmBooking = () => useBookingMutation((id: string) => api.confirmBooking(id));
export const useUnconfirmBooking = () => useBookingMutation((id: string) => api.unconfirmBooking(id));
export const useCancelBooking = () =>
  useBookingMutation(({ id, reason }: { id: string; reason: string }) => api.cancelBooking(id, reason));
export const useClassAction = () =>
  useBookingMutation(({ id, action }: { id: string; action: 'accept' | 'decline' | 'reset' }) =>
    api.changeClassBooking(id, action),
  );

export function useChats() {
  return useQuery({ queryKey: keys.chats, queryFn: api.fetchChats });
}

/** A conversa aberta. No portal real, buscá-la já marca como lida. */
export function useChat(slug: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.thread(slug),
    enabled: !!slug,
    queryFn: async () => {
      const chat = await api.fetchChatThread(slug!);
      // Depois de abrir, o contador de não lidas do portal já zerou: atualiza a lista e o selo.
      if (clientDataMode() === 'live') void qc.invalidateQueries({ queryKey: keys.chats });
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
