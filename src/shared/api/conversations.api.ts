import { api } from './client';
import { appendUpload } from './upload';

export type ApiConversation = {
  id: string;
  status?: string;
  channel?: string;
  contact_id?: string;
  current_queue_id?: string | null;
  current_queue_name?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  unread_count?: number;
  last_customer_message_at?: string | null;
  service_window_expires_at?: string | null;
  contact?: {
    id?: string;
    name?: string | null;
    phone_e164?: string | null;
  };
  preview?: string | null;
  last_message_preview?: string | null;
  /** Número/conexão por onde a conversa chegou (empresa com vários números). */
  connection_id?: string | null;
  /** Número pelo qual a conversa responde (conversa → fila → principal); só no detalhe. */
  outbound_connection_id?: string | null;
  /** Resumo e leitura da IA (só com o app de IA da empresa). */
  ai_summary?: string | null;
  ai_summary_status?: 'pending' | 'ready' | 'skipped' | 'failed' | null;
  ai_summary_at?: string | null;
  ai_summary_rating?: 'up' | 'down' | null;
  ai_sentiment?: string | null;
  ai_sentiment_score?: number | null;
  ai_primary_intent?: string | null;
};

export type ApiMessage = {
  id: string;
  /** A linha do tempo do contato junta as conversas dele: de qual conversa e canal esta mensagem é. */
  conversation_id?: string;
  source_channel?: string | null;
  source_connection_id?: string | null;
  direction?: 'inbound' | 'outbound' | string;
  type?: string;
  body?: string | null;
  caption?: string | null;
  status?: string;
  created_at?: string;
  media_id?: string | null;
  message_type?: string;
  /** Campos atuais da API (`conversation_messages`); `body`/`type` ficam para respostas antigas. */
  body_text?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  template_name?: string | null;
  payload_json?: ({ pix?: { key: string; key_type: string; holder_name: string }; caption?: string; filename?: string } & Record<string, unknown>) | null;
};

export async function listConversations(params?: Record<string, unknown>) {
  const { data } = await api.get('/api/conversations', { params });
  return data as { data: ApiConversation[]; total: number; page: number; limit: number };
}

export async function getMyHistory(params?: Record<string, unknown>) {
  const { data } = await api.get('/api/conversations/my-history', { params });
  return data as { data: ApiConversation[]; total: number };
}

export async function getConversation(id: string) {
  const { data } = await api.get(`/api/conversations/${id}`);
  return data as ApiConversation;
}

/**
 * Linha do tempo do contato (mesma rota do Operax web): as mensagens mais recentes, em ordem.
 * `/messages` só pagina para trás a partir de `before_id` e, sem ele, volta vazio.
 */
export async function getConversationMessages(id: string, limit = 50) {
  const { data } = await api.get(`/api/conversations/${id}/timeline`, {
    params: { limit: Math.min(limit, 100) },
  });
  // API pode devolver { messages } ou array
  if (Array.isArray(data)) return { messages: data as ApiMessage[], hasMore: false };
  return data as { messages: ApiMessage[]; hasMore?: boolean };
}

export async function markConversationRead(id: string) {
  await api.post(`/api/conversations/${id}/read`);
}

export async function sendTextMessage(id: string, body: string) {
  const { data } = await api.post(`/api/conversations/${id}/messages`, {
    type: 'text',
    body,
  });
  return data;
}

export async function claimConversation(id: string) {
  const { data } = await api.post(`/api/conversations/${id}/claim`);
  return data;
}

export async function releaseConversation(id: string) {
  await api.post(`/api/conversations/${id}/release`);
}

export async function transferConversation(id: string, target_user_id: string) {
  const { data } = await api.post(`/api/conversations/${id}/transfer`, { target_user_id });
  return data;
}

export async function transferConversationToQueue(id: string, target_queue_id: string) {
  const { data } = await api.post(`/api/conversations/${id}/transfer-queue`, { target_queue_id });
  return data;
}

export async function closeConversation(id: string) {
  const { data } = await api.patch(`/api/conversations/${id}/close`, {});
  return data;
}

export async function sendMediaMessage(
  conversationId: string,
  file: { uri: string; name: string; type: string },
  caption?: string,
) {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  if (caption) form.append('caption', caption);
  const { data } = await api.post(`/api/conversations/${conversationId}/messages/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
