import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['auth', 'common']);
  const can = useCan();
  if (can(need)) return <>{children}</>;
  return (
    <Screen>
      <TopBar safe title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <EmptyState
        icon="lock-closed-outline"
        title={t('noAccess.title')}
        subtitle={t('noAccess.subtitle')}
        actionLabel={t('common:actions.back')}
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </Screen>
  );
}
