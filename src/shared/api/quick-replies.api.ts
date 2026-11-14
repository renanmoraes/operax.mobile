import { api } from './client';

export type ApiQuickReply = {
  id: string;
  slug: string;
  title: string;
  body: string;
};

/** Lista as respostas rápidas; `search` filtra no servidor (mesma busca do atalho "/" do Operax web). */
export async function listQuickReplies(params?: { search?: string; limit?: number }): Promise<ApiQuickReply[]> {
  const { data } = await api.get('/api/quick-replies', { params });
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiQuickReply[];
}
