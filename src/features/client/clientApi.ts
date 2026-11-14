import { buildMockBookings, buildMockChats, mockCompanies } from './mocks';
import type { ChatMessage, ClientBooking, ClientChat, ClientCompany, OutgoingAttachment } from './types';

/**
 * Fonte de dados do cliente. Hoje é um store em memória com o formato da API do portal;
 * quando o login mobile de cliente existir, cada função vira a chamada `me/...` correspondente.
 */

let bookings: ClientBooking[] | null = null;
let chats: ClientChat[] | null = null;

const tick = () => new Promise((r) => setTimeout(r, 120));
const getBookings = () => (bookings ??= buildMockBookings());
const getChats = () => (chats ??= buildMockChats());

export async function fetchCompanies(): Promise<ClientCompany[]> {
  await tick();
  return mockCompanies;
}

export async function fetchBookings(): Promise<ClientBooking[]> {
  await tick();
  return [...getBookings()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function patchBooking(id: string, patch: Partial<ClientBooking>) {
  bookings = getBookings().map((b) => (b.id === id ? { ...b, ...patch } : b));
  return bookings.find((b) => b.id === id)!;
}

export async function confirmBooking(id: string) {
  await tick();
  return patchBooking(id, { status: 'confirmed', can_confirm: false });
}

export async function unconfirmBooking(id: string) {
  await tick();
  return patchBooking(id, { status: 'pending', can_confirm: true });
}

export async function cancelBooking(id: string, _reason: string) {
  await tick();
  return patchBooking(id, { status: 'cancelled', can_confirm: false, can_cancel: false });
}

export async function changeClassBooking(id: string, action: 'accept' | 'decline' | 'reset') {
  await tick();
  if (action === 'accept') {
    const b = getBookings().find((x) => x.id === id)!;
    return patchBooking(id, { status: 'confirmed', can_accept: false, can_cancel: true, class_enrolled: (b.class_enrolled ?? 0) + 1 });
  }
  if (action === 'decline') return patchBooking(id, { status: 'cancelled', can_accept: false });
  const fresh = buildMockBookings().find((x) => x.id === id)!;
  return patchBooking(id, fresh);
}

export async function fetchChats(): Promise<ClientChat[]> {
  await tick();
  return getChats();
}

export async function markChatRead(slug: string) {
  chats = getChats().map((c) => (c.tenant_slug === slug ? { ...c, unread: 0 } : c));
}

export async function sendChatMessage(
  slug: string,
  input: { text: string; attachment?: OutgoingAttachment; reschedule?: ChatMessage['reschedule'] },
): Promise<ChatMessage> {
  await tick();
  const att = input.attachment;
  const message: ChatMessage = {
    id: `local-${Date.now()}`,
    from: 'me',
    text: input.text,
    at: new Date().toISOString(),
    status: 'sent',
    reschedule: input.reschedule,
    attachment: att
      ? att.kind === 'document'
        ? { kind: 'document', uri: att.uri, name: att.name ?? 'Documento', size_bytes: att.size_bytes ?? 0 }
        : att.kind === 'video'
          ? { kind: 'video', uri: att.uri, duration_s: att.duration_s ?? 0 }
          : { kind: 'image', uri: att.uri }
      : null,
  };
  chats = getChats().map((c) => (c.tenant_slug === slug ? { ...c, messages: [...c.messages, message] } : c));
  return message;
}
