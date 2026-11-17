import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/features/auth/AuthContext';
import { fetchPosBootstrap } from '@/src/shared/api/pos.api';
import { fetchActiveApps } from '@/src/shared/api/apps.api';
import { visibleSections, type SectionId } from './sections';

/** Todas as seções do contato que a pessoa logada pode abrir (permissão + apps instalados + crediário ligado). */
export function useContactAccess() {
  const { user, mode } = useAuth();
  const live = mode === 'live';
  const permissions = user?.kind === 'staff' ? user.permissions : undefined;

  const appsQ = useQuery({ queryKey: ['active-apps'], enabled: live, staleTime: 60_000, queryFn: fetchActiveApps });
  // Demonstração mostra tudo o que o app já sabe fazer.
  const apps = live ? appsQ.data ?? null : ['agenda', 'pos'];

  const hasPos = (apps ?? []).includes('pos');
  const bootQ = useQuery({
    queryKey: ['pos', 'bootstrap'],
    enabled: live && hasPos,
    staleTime: 60_000,
    queryFn: fetchPosBootstrap,
  });
  // Sem resposta ainda, assume ligado: o web esconde só quando o servidor diz que não vende a prazo.
  const crediario = live ? bootQ.data?.settings?.on_account_enabled !== false : true;

  const sections = visibleSections({ permissions, apps, crediario });
  const can = (id: SectionId) => sections.some((s) => s.id === id);
  return { sections, can, loading: live && appsQ.isLoading };
}
