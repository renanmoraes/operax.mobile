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

export function mapApiMessage(m: ApiMessage, conversationId: string): Message {
  const inbound = m.direction === 'inbound' || m.direction === 'in';
  const type = (m.type as Message['type']) || 'text';
  const pix = (m.message_type === 'pix' || m.type === 'pix') && m.payload_json?.pix ? (m.payload_json.pix as Message['pix']) : undefined;
  if (pix) {
    return { id: m.id, conversationId, direction: inbound ? 'in' : 'out', type: 'pix', body: m.body || 'Chave Pix', at: formatTime(m.created_at), status: (m.status as Message['status']) || undefined, pix };
  }
  return {
    id: m.id,
    conversationId,
    direction: inbound ? 'in' : 'out',
    type: ['image', 'audio', 'video', 'document'].includes(type) ? type : 'text',
    body: m.body || m.caption || (m.media_id ? `[${type}]` : ''),
    at: formatTime(m.created_at),
    status: (m.status as Message['status']) || undefined,
    caption: type !== 'text' && m.caption ? m.caption : undefined,
  };
}
