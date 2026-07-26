import { api } from './client';

export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read?: boolean;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

export async function listNotifications(page = 1, limit = 30) {
  const { data } = await api.get('/api/notifications', {
    params: { page, limit },
  });
  if (Array.isArray(data)) return { data: data as ApiNotification[] };
  return data as { data: ApiNotification[]; total?: number };
}

export async function markNotificationRead(id: string) {
  await api.patch(`/api/notifications/${id}/read`);
}
