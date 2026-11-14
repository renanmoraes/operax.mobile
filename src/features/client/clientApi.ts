import {
  portalCancelBooking,
  portalChat,
  portalChatMedia,
  portalClassAction,
  portalConfirmBooking,
  portalHome,
  portalMyCompanies,
  portalSendChat,
  type PortalHome,
} from '@/src/shared/api/portal.api';
import { clientDataMode } from './dataMode';
import { buildMockBookings, buildMockChats, mockCompanies } from './mocks';
import { mapPortalBooking, mapPortalChat, mapPortalCompany } from './portalMapping';
import type { ChatMessage, ClientBooking, ClientChat, ClientCompany, OutgoingAttachment } from './types';

/**
 * Fonte de dados do cliente. Login real: rotas `me/*` do portal (a empresa é a da sessão).
 * Modo demonstração: store em memória com o mesmo formato.
 */

const live = () => clientDataMode() === 'live';

/** Erro com texto para mostrar na tela (ação que o portal ainda não oferece). */
const unsupported = (text: string) => new Error(text);

let lastHome: PortalHome | null = null;
async function home(fresh = false) {
  if (fresh || !lastHome) lastHome = await portalHome();
  return lastHome;
}
const liveBooking = async (id: string) => (await home(true)).bookings.find((b) => b.id === id);
async function refreshedBooking(id: string): Promise<ClientBooking> {
  const h = await home(true);
  const b = h.bookings.find((x) => x.id === id);
  if (!b) throw unsupported('Esse compromisso não está mais na sua agenda.');
  return mapPortalBooking(b, h);
}

let bookings: ClientBooking[] | null = null;
let chats: ClientChat[] | null = null;

const tick = () => new Promise((r) => setTimeout(r, 120));
const getBookings = () => (bookings ??= buildMockBookings());
const getChats = () => (chats ??= buildMockChats());

export async function fetchCompanies(): Promise<ClientCompany[]> {
  if (live()) {
    const [companies, h] = await Promise.all([portalMyCompanies(), home()]);
    return companies.map((c) => mapPortalCompany(c, h));
  }
  await tick();
  return mockCompanies;
}

export async function fetchBookings(): Promise<ClientBooking[]> {
  if (live()) {
    const h = await home(true);
    return h.bookings.map((b) => mapPortalBooking(b, h)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  await tick();
  return [...getBookings()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function patchBooking(id: string, patch: Partial<ClientBooking>) {
  bookings = getBookings().map((b) => (b.id === id ? { ...b, ...patch } : b));
  return bookings.find((b) => b.id === id)!;
}

export async function confirmBooking(id: string) {
  if (live()) {
    await portalConfirmBooking(id);
    return refreshedBooking(id);
  }
  await tick();
  return patchBooking(id, { status: 'confirmed', can_confirm: false });
}

export async function unconfirmBooking(id: string) {
  if (live()) throw unsupported('Para desfazer a confirmação, fale com a equipe pelo chat.');
  await tick();
  return patchBooking(id, { status: 'pending', can_confirm: true });
}

export async function cancelBooking(id: string, reason: string) {
  if (live()) {
    const b = await liveBooking(id);
    if (b?.kind === 'class') await portalClassAction(id, 'cancel');
    else await portalCancelBooking(id, reason);
    return refreshedBooking(id).catch(() => null);
  }
  await tick();
  return patchBooking(id, { status: 'cancelled', can_confirm: false, can_cancel: false });
}

export async function changeClassBooking(id: string, action: 'accept' | 'decline' | 'reset') {
  if (live()) {
    if (action === 'reset') throw unsupported('Essa vaga já foi respondida. Fale com a equipe pelo chat para mudar.');
    await portalClassAction(id, action === 'accept' ? 'accept' : 'cancel');
    return refreshedBooking(id).catch(() => null);
  }
  await tick();
  if (action === 'accept') {
    const b = getBookings().find((x) => x.id === id)!;
    return patchBooking(id, { status: 'confirmed', can_accept: false, can_cancel: true, class_enrolled: (b.class_enrolled ?? 0) + 1 });
  }
  if (action === 'decline') return patchBooking(id, { status: 'cancelled', can_accept: false });
  const fresh = buildMockBookings().find((x) => x.id === id)!;
  return patchBooking(id, fresh);
}

/** Os anexos vêm sem link: pede o link assinado dos mais recentes (o resto aparece como "anexo"). */
const MEDIA_LIMIT = 30;
/** Última conversa aberta, de quem (contato + empresa): a lista mostra a prévia sem reabrir a conversa. */
let lastThread: { owner: string; chat: ClientChat } | null = null;
const ownerOf = (h: PortalHome) => `${h.contact.id}:${h.tenant_slug}`;

/** Troca de pessoa ou empresa: nada da conta anterior pode aparecer na próxima. */
export function resetClientCache() {
  lastHome = null;
  lastThread = null;
  mediaUrls.clear();
}

/** Links assinados dos anexos: reaproveitados por alguns minutos (a conversa aberta é atualizada sempre). */
const MEDIA_TTL = 5 * 60_000;
const mediaUrls = new Map<string, { url: string; at: number }>();
async function mediaUrl(messageId: string): Promise<string | null> {
  const hit = mediaUrls.get(messageId);
  if (hit && Date.now() - hit.at < MEDIA_TTL) return hit.url;
  try {
    const { url } = await portalChatMedia(messageId);
    mediaUrls.set(messageId, { url, at: Date.now() });
    return url;
  } catch {
    return null; // sem o link o balão continua mostrando o tipo do anexo
  }
}

/** Conversa inteira. No portal, abrir a conversa (GET me/chat) já marca como lida. */
async function liveThread(): Promise<ClientChat> {
  const [chat, h] = await Promise.all([portalChat(), home(true)]);
  const mapped = mapPortalChat(chat, h);
  const withMedia = mapped.messages.filter((m) => m.attachment).slice(-MEDIA_LIMIT);
  const urls = new Map<string, string>();
  await Promise.all(
    withMedia.map(async (m) => {
      const url = await mediaUrl(m.id);
      if (url) urls.set(m.id, url);
    }),
  );
  const chatView: ClientChat = { ...mapped, unread: 0, messages: mapped.messages.map((m) => (m.attachment && urls.has(m.id) ? { ...m, attachment: { ...m.attachment, uri: urls.get(m.id)! } } : m)) };
  lastThread = { owner: ownerOf(h), chat: chatView };
  return chatView;
}

/** Lista de conversas (início e aba Conversas): não pode marcar como lida o que a pessoa ainda não abriu. */
export async function fetchChats(): Promise<ClientChat[]> {
  if (live()) {
    const h = await home(true);
    if (!h.capabilities.chat) return [];
    const unread = h.badges?.chat ?? 0;
    if (unread === 0) return [await liveThread()];
    const base = lastThread?.owner === ownerOf(h) ? lastThread.chat : mapPortalChat({ messages: [], service_hours_text: h.service_hours_text ?? null, whatsapp_url: null }, h);
    return [{ ...base, unread }];
  }
  await tick();
  return getChats();
}

export async function fetchChatThread(slug: string): Promise<ClientChat | undefined> {
  if (live()) return liveThread();
  await tick();
  return getChats().find((c) => c.tenant_slug === slug);
}

export async function markChatRead(slug: string) {
  if (live()) return; // o portal marca como lido ao abrir a conversa
  chats = getChats().map((c) => (c.tenant_slug === slug ? { ...c, unread: 0 } : c));
}

export async function sendChatMessage(
  slug: string,
  input: { text: string; attachment?: OutgoingAttachment; reschedule?: ChatMessage['reschedule'] },
): Promise<ChatMessage> {
  if (live()) {
    if (input.attachment) throw unsupported('Por enquanto o chat aceita só texto. Para enviar arquivos, use o WhatsApp da empresa.');
    const r = input.reschedule;
    const about = r ? `\n\nSobre: ${r.title} de ${new Date(r.original_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
    const text = `${input.text.trim() || (r ? 'Consigo outro horário?' : '')}${about}`.trim();
    if (!text) throw unsupported('Escreva a mensagem antes de enviar.');
    await portalSendChat(text);
    return { id: `local-${Date.now()}`, from: 'me', text, at: new Date().toISOString(), status: 'sent', attachment: null };
  }
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
          : att.kind === 'audio'
            ? { kind: 'audio', uri: att.uri, duration_s: att.duration_s ?? 0 }
            : { kind: 'image', uri: att.uri }
      : null,
  };
  chats = getChats().map((c) => (c.tenant_slug === slug ? { ...c, messages: [...c.messages, message] } : c));
  return message;
}
