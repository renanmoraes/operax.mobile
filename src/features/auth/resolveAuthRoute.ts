import { firstStaffTab } from './permissions';

export type AuthRouteInput =
  | { phase: 'role_unselected' }
  | { phase: 'staff'; authenticated: boolean; needsMfa: boolean; permissions?: readonly string[] }
  | { phase: 'client'; authenticated: boolean; activeTenantId: string | null };

export type AuthRoute =
  | '/(auth)/role-select'
  | '/(auth)/login'
  | '/(auth)/mfa'
  | '/(app)/inbox'
  | '/(app)/agenda'
  | '/(app)/notifications'
  | '/(auth)/client-login'
  | '/(auth)/client-tenant-select'
  | '/(client)/inicio';

export function resolveAuthRoute(input: AuthRouteInput): AuthRoute {
  if (input.phase === 'role_unselected') return '/(auth)/role-select';

  if (input.phase === 'staff') {
    // Abre na primeira aba que o perfil permite (sem atendimento, vai para a agenda ou avisos).
    if (input.authenticated) return firstStaffTab(input.permissions);
    return input.needsMfa ? '/(auth)/mfa' : '/(auth)/login';
  }

  if (!input.authenticated) return '/(auth)/client-login';
  return input.activeTenantId == null ? '/(auth)/client-tenant-select' : '/(client)/inicio';
}
