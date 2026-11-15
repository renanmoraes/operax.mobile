import { resolveAuthRoute } from '../resolveAuthRoute';

describe('resolveAuthRoute', () => {
  it('sem papel salvo, pede a escolha', () => {
    expect(resolveAuthRoute({ phase: 'role_unselected' })).toBe('/(auth)/role-select');
  });

  it('staff sem sessão vai pro login', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: false, needsMfa: false })).toBe(
      '/(auth)/login',
    );
  });

  it('staff com mfa pendente vai pro mfa', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: false, needsMfa: true })).toBe(
      '/(auth)/mfa',
    );
  });

  it('staff autenticado abre na primeira aba que o perfil permite', () => {
    expect(resolveAuthRoute({ phase: 'staff', authenticated: true, needsMfa: false, permissions: ['*'] })).toBe('/(app)/inbox');
    expect(resolveAuthRoute({ phase: 'staff', authenticated: true, needsMfa: false, permissions: ['scheduling:read_all'] })).toBe('/(app)/agenda');
    expect(resolveAuthRoute({ phase: 'staff', authenticated: true, needsMfa: false, permissions: [] })).toBe('/(app)/notifications');
  });

  it('cliente sem sessão vai pro login de cliente', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: false, activeTenantId: null }),
    ).toBe('/(auth)/client-login');
  });

  it('cliente autenticado sem empresa ativa vai pro seletor (cobre 2+ vínculos e o caso raro de 1 vínculo sem escopo)', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: true, activeTenantId: null }),
    ).toBe('/(auth)/client-tenant-select');
  });

  it('cliente autenticado com empresa ativa vai pro shell de cliente', () => {
    expect(
      resolveAuthRoute({ phase: 'client', authenticated: true, activeTenantId: 't1' }),
    ).toBe('/(client)/inicio');
  });
});
