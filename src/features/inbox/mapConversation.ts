import type { ApiConversation, ApiMessage } from '@/src/shared/api/conversations.api';
import type { Conversation, Message } from '@/src/mocks/data';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function mapApiConversation(c: ApiConversation, currentUserId?: string): Conversation {
  const assigned = c.assigned_user_id;
  const closed = c.status === 'closed' || c.status === 'expired';
  const inQueue = !assigned && !closed;
  const mine = !!currentUserId && assigned === currentUserId;
  const within24h = c.service_window_expires_at
    ? new Date(c.service_window_expires_at).getTime() > Date.now()
    : true;

  return {
    id: c.id,
    contactName: c.contact?.name || c.contact?.phone_e164 || 'Contato',
    contactId: c.contact?.id || c.contact_id || '',
    lastMessage: c.last_message_preview || c.preview || '—',
    updatedAt: formatTime(c.last_customer_message_at) || '—',
    unread: c.unread_count ?? 0,
    queue: c.current_queue_name || 'Fila',
    channel: (c.channel as Conversation['channel']) || 'whatsapp',
    segment: closed ? 'history' : mine ? 'active' : inQueue ? 'queue' : 'active',
    ownership: closed ? 'closed' : mine ? 'mine' : inQueue ? 'queue' : 'other',
    within24h,
  };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Id da mídia no servidor a partir de `media_url` (`/api/media/:id/...` ou só o id); link externo não tem id. */
export function mediaIdFrom(m: Pick<ApiMessage, 'media_id' | 'media_url'>): string | undefined {
  if (m.media_id) return m.media_id;
  const url = m.media_url ?? '';
  if (!url || /^https?:\/\//i.test(url)) return undefined;
  return url.match(UUID)?.[0];
}

const STATUS: Record<string, Message['status']> = { accepted: 'sent', sent: 'sent', delivered: 'delivered', read: 'read' };

export function mapApiMessage(m: ApiMessage, conversationId: string): Message {
  const inbound = m.direction === 'inbound' || m.direction === 'in';
  const rawType = (m.message_type || m.type || 'text').toLowerCase();
  const type = (rawType === 'sticker' ? 'image' : rawType) as Message['type'];
  const text = m.body_text ?? m.body ?? null;
  const caption = m.caption ?? (typeof m.payload_json?.caption === 'string' ? m.payload_json.caption : null);
  const pix = (m.message_type === 'pix' || m.type === 'pix') && m.payload_json?.pix ? (m.payload_json.pix as Message['pix']) : undefined;
  if (pix) {
    return { id: m.id, conversationId, direction: inbound ? 'in' : 'out', type: 'pix', body: text || 'Chave Pix', at: formatTime(m.created_at), status: STATUS[m.status ?? ''], pix };
  }
  return {
    id: m.id,
    conversationId,
    direction: inbound ? 'in' : 'out',
    type: ['image', 'audio', 'video', 'document'].includes(type) ? type : 'text',
    // Template sem texto salvo mostra o nome; botão/lista mostram o rótulo que veio em body_text.
    body: text || caption || (m.template_name ? `Modelo: ${m.template_name}` : m.media_url || m.media_id ? `[${type}]` : ''),
    at: formatTime(m.created_at),
    status: STATUS[m.status ?? ''],
    caption: type !== 'text' && caption ? caption : undefined,
    fileName: typeof m.payload_json?.filename === 'string' ? m.payload_json.filename : undefined,
    mediaId: mediaIdFrom(m),
  };
}
