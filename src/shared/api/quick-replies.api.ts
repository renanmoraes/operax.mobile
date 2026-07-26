import { api } from './client';

export type ApiQuickReply = {
  id: string;
  slug: string;
  title: string;
  body: string;
};

export async function listQuickReplies(): Promise<ApiQuickReply[]> {
  const { data } = await api.get('/api/quick-replies');
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiQuickReply[];
}
