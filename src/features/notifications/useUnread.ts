import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/features/auth/AuthContext';
import { listNotifications } from '@/src/shared/api/notifications.api';

/** Quantos avisos ainda não foram lidos (a mesma consulta da tela de Avisos, então os dois mostram o mesmo número). */
export function useUnreadNotifications(): number {
  const { mode, user } = useAuth();
  const { data } = useQuery({
    queryKey: ['notifications', mode],
    enabled: mode === 'live' && user?.kind === 'staff',
    refetchInterval: 60_000,
    queryFn: async () => (await listNotifications(1, 40)).data ?? [],
  });
  return (data ?? []).filter((n) => !n.is_read).length;
}
