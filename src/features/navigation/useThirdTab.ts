import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/features/auth/AuthContext';
import { useCan } from '@/src/features/auth/useCan';
import { getActiveApps } from '@/src/shared/api/attendance.api';

export type ThirdTab = 'pdv' | 'people' | 'notifications';

/**
 * A terceira aba da barra da equipe. Quem vende (PDV instalado e permissão de vender) ganha o PDV; quem não tem PDV mas vê
 * os cadastros ganha a lista de pessoas (Pacientes, Clientes… conforme o vocabulário da empresa); sem nenhum dos dois,
 * fica o sino de avisos. Os avisos continuam à mão no topo do Atendimento e no menu Mais.
 */
export function useThirdTab(): ThirdTab {
  const { mode, user } = useAuth();
  const can = useCan();
  const staff = user?.kind === 'staff';
  const apps = useQuery({ queryKey: ['active-apps'], enabled: mode === 'live' && staff, staleTime: 10 * 60_000, queryFn: getActiveApps });
  const hasPos = can('posSell') && (mode !== 'live' || (apps.data ?? []).includes('pos'));
  if (hasPos) return 'pdv';
  if (can('contacts')) return 'people';
  return 'notifications';
}
