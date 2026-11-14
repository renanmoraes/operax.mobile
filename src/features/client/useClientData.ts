import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './clientApi';
import type { ChatMessage, OutgoingAttachment } from './types';

const keys = {
  companies: ['client', 'companies'] as const,
  bookings: ['client', 'bookings'] as const,
  chats: ['client', 'chats'] as const,
};

export function useCompanies() {
  return useQuery({ queryKey: keys.companies, queryFn: api.fetchCompanies });
}

export function useBookings() {
  return useQuery({ queryKey: keys.bookings, queryFn: api.fetchBookings });
}

export function useBooking(id: string | undefined) {
  const q = useBookings();
  return { ...q, data: q.data?.find((b) => b.id === id) };
}

function useBookingMutation<A>(fn: (arg: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookings }) });
}

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

export function useChat(slug: string | undefined) {
  const q = useChats();
  return { ...q, data: q.data?.find((c) => c.tenant_slug === slug) };
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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chats }),
  });
}
