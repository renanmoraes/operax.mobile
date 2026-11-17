import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/src/features/auth/AuthContext';
import { setVocabulary } from '@/src/i18n';
import { fetchTenantVocabulary } from '@/src/shared/api/vocabulary.api';

/**
 * Mantém o app da equipe com as palavras da empresa (ex.: Pacientes no lugar de Contatos). Busca ao entrar, de minuto em
 * minuto e toda vez que o app volta ao primeiro plano, então instalar ou trocar um app de terminologia no Operax chega
 * aqui sem sair da conta. Sem login real de equipe, volta ao padrão.
 */
export function useVocabularySync() {
  const { user, mode } = useAuth();
  const qc = useQueryClient();
  const enabled = mode === 'live' && user?.kind === 'staff';
  const tenant = user?.kind === 'staff' ? user.tenant_id : null;

  const q = useQuery({ queryKey: ['vocabulary', tenant], queryFn: fetchTenantVocabulary, enabled, staleTime: 60_000, refetchInterval: 5 * 60_000, retry: 1 });

  useEffect(() => {
    if (!enabled) {
      setVocabulary({});
      return;
    }
    if (q.data) setVocabulary(q.data);
  }, [enabled, q.data]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void qc.invalidateQueries({ queryKey: ['vocabulary', tenant] });
    });
    return () => sub.remove();
  }, [enabled, qc, tenant]);
}
