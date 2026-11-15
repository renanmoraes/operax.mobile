import { isAuthRoute } from '../client';

describe('isAuthRoute', () => {
  it('reconhece as rotas de staff sem Bearer válido ainda', () => {
    expect(isAuthRoute('/api/auth/login')).toBe(true);
    expect(isAuthRoute('/api/auth/refresh')).toBe(true);
    expect(isAuthRoute('/api/auth/logout')).toBe(true);
    expect(isAuthRoute('/api/auth/mfa/verify')).toBe(true);
  });

  it('reconhece as rotas de cliente sem Bearer válido ainda', () => {
    expect(isAuthRoute('/api/auth/client/login')).toBe(true);
    expect(isAuthRoute('/api/auth/client/otp/request')).toBe(true);
    expect(isAuthRoute('/api/auth/client/otp/verify')).toBe(true);
  });

  it('NÃO marca switch-tenant nem /client/me — são chamadas autenticadas normais', () => {
    expect(isAuthRoute('/api/auth/client/switch-tenant')).toBe(false);
    expect(isAuthRoute('/api/auth/client/me')).toBe(false);
  });

  it('não marca rotas de negócio', () => {
    expect(isAuthRoute('/api/conversations')).toBe(false);
  });
});
