import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { EmptyState, Screen, TopBar } from '@/src/design-system/ui';
import { useAuth } from './AuthContext';
import { hasPermission, PERMS, type PermKey, type PermissionNeed } from './permissions';

/** `can('kanban')` ou `can(['x:a', 'x:b'])`: o que a pessoa logada (equipe) pode fazer. */
export function useCan() {
  const { user } = useAuth();
  const permissions = user?.kind === 'staff' ? user.permissions : undefined;
  return (need: PermKey | PermissionNeed) => {
    if (user?.kind !== 'staff') return false;
    const required = typeof need === 'string' && need in PERMS ? PERMS[need as PermKey] : need;
    return hasPermission(permissions, required);
  };
}

/** Tela aberta por link sem a permissão: explica e volta, sem mostrar nada do conteúdo. */
export function RequirePermission({ need, title, children }: { need: PermKey | PermissionNeed; title: string; children: ReactNode }) {
  const can = useCan();
  if (can(need)) return <>{children}</>;
  return (
    <Screen>
      <TopBar safe title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <EmptyState
        icon="lock-closed-outline"
        title="Sem acesso a esta área"
        subtitle="Seu perfil no Operax não tem permissão para isso. Se precisar, peça ao administrador da empresa."
        actionLabel="Voltar"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </Screen>
  );
}
