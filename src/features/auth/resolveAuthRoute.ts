export type AuthRouteInput =
  | { phase: 'role_unselected' }
  | { phase: 'staff'; authenticated: boolean; needsMfa: boolean }
  | { phase: 'client'; authenticated: boolean; activeTenantId: string | null };

export type AuthRoute =
  | '/(auth)/role-select'
  | '/(auth)/login'
  | '/(auth)/mfa'
  | '/(app)/inbox'
  | '/(auth)/client-login'
  | '/(auth)/client-tenant-select'
  | '/(client)/inicio';

export function resolveAuthRoute(input: AuthRouteInput): AuthRoute {
  if (input.phase === 'role_unselected') return '/(auth)/role-select';

  if (input.phase === 'staff') {
    if (input.authenticated) return '/(app)/inbox';
    return input.needsMfa ? '/(auth)/mfa' : '/(auth)/login';
  }

  if (!input.authenticated) return '/(auth)/client-login';
  return input.activeTenantId == null ? '/(auth)/client-tenant-select' : '/(client)/inicio';
}
