import { api } from './client';
import { appendUpload } from './upload';

/** Chat interno da equipe: mesmos endpoints do Operax web (`/api/chat/*`). */

export type ApiTeamChannel = {
  id: string;
  type: 'dm' | 'group' | string;
  name: string | null;
  topic?: string | null;
  icon?: string | null;
  created_at?: string;
  last_message_at?: string | null;
  pinned_at?: string | null;
  unread_count: number;
  peer?: { user_id: string; name: string } | null;
};

export type ApiTeamMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name?: string | null;
  body?: string | null;
  kind?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  media_filename?: string | null;
  media_size_bytes?: number | null;
  deleted_at?: string | null;
  edited_at?: string | null;
  created_at: string;
  reply_to?: { id: string; sender_name: string | null; body: string | null } | null;
};

export type ApiTeamUnread = { total: number; by_channel: { id: string; count: number }[] };

export async function listTeamChannels(): Promise<ApiTeamChannel[]> {
  const { data } = await api.get('/api/chat/channels');
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiTeamChannel[];
}

export async function getTeamUnread(): Promise<ApiTeamUnread> {
  const { data } = await api.get('/api/chat/unread-count');
  return { total: Number(data?.total ?? 0), by_channel: data?.by_channel ?? [] };
}

export async function listTeamMessages(channelId: string, limit = 60): Promise<ApiTeamMessage[]> {
  const { data } = await api.get(`/api/chat/channels/${channelId}/messages`, { params: { limit } });
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiTeamMessage[];
}

export async function sendTeamMessage(channelId: string, body: string): Promise<ApiTeamMessage> {
  const { data } = await api.post(`/api/chat/channels/${channelId}/messages`, { body });
  return data as ApiTeamMessage;
}

/** Imagem, PDF ou áudio (multipart com o campo "file"; legenda vai em "body"). */
export async function sendTeamMedia(
  channelId: string,
  file: { uri: string; name: string; type: string },
  caption?: string,
): Promise<ApiTeamMessage> {
  const form = new FormData();
  await appendUpload(form, 'file', file);
  if (caption) form.append('body', caption);
  const { data } = await api.post(`/api/chat/channels/${channelId}/messages/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as ApiTeamMessage;
}

export async function markTeamChannelRead(channelId: string): Promise<void> {
  await api.post(`/api/chat/channels/${channelId}/read`);
}
