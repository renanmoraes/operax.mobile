import { api } from './client';

export type ApiTemplate = {
  id: string;
  name: string;
  category?: string;
  language?: string;
  status?: string;
  body?: string;
  components?: unknown;
};

export async function listTemplates(params?: { status?: string }): Promise<ApiTemplate[]> {
  const { data } = await api.get('/api/templates', { params });
  return (Array.isArray(data) ? data : data?.data ?? []) as ApiTemplate[];
}

export async function sendTemplateMessage(
  conversationId: string,
  payload: { template_id: string; manual_values?: Record<string, string> },
) {
  const { data } = await api.post(`/api/conversations/${conversationId}/messages/template`, payload);
  return data;
}
