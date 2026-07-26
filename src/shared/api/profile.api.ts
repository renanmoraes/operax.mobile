import { api } from './client';
import type { NotificationPrefsState } from '@/src/features/notifications/catalog';

export async function updateNotificationPrefs(
  prefs: NotificationPrefsState,
  name: string,
) {
  const { data } = await api.patch('/api/auth/me', {
    name,
    notification_prefs: {
      sound: prefs.sound,
      desktop: prefs.desktop,
      email_digest: prefs.email_digest,
      push: prefs.push,
      categories: prefs.categories,
    },
  });
  return data;
}
