import { api } from '../client';
import { clientLoginApi, getClientMeApi, getMeApi, loginApi } from '../auth.api';

jest.mock('../client', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../token-store', () => ({ setTokens: jest.fn(), clearTokens: jest.fn() }));

describe('normalização de kind (o backend não devolve esse campo)', () => {
  it('getMeApi marca kind: staff', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 'u1', name: 'Ana', email: 'a@a.com' } });
    const user = await getMeApi();
    expect(user.kind).toBe('staff');
  });

  it('loginApi marca kind: staff no bundle de tokens', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { user: { id: 'u1', name: 'Ana', email: 'a@a.com' }, access_token: 'a', refresh_token: 'r' },
    });
    const result = await loginApi({ email: 'a@a.com', password: 'x', company_code: 'OPRX' });
    expect('user' in result && result.user.kind).toBe('staff');
  });

  it('loginApi não quebra quando é status de mfa (sem user)', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { status: 'mfa_required', mfa_token: 't' } });
    const result = await loginApi({ email: 'a@a.com', password: 'x', company_code: 'OPRX' });
    expect('status' in result && result.status).toBe('mfa_required');
  });

  it('getClientMeApi marca kind: client', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { id: 'c1', name: 'Cliente', active_tenant_id: 't1', memberships: [] },
    });
    const user = await getClientMeApi();
    expect(user.kind).toBe('client');
  });

  it('clientLoginApi marca kind: client quando autentica, e não quebra no bloqueio', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 'c1', name: 'Cliente', active_tenant_id: 't1', memberships: [] },
        access_token: 'a',
        refresh_token: 'r',
      },
    });
    const ok = await clientLoginApi({ identifier: 'c@c.com', password: 'x' });
    expect('user' in ok && ok.user.kind).toBe('client');

    (api.post as jest.Mock).mockResolvedValueOnce({ data: { status: 'no_portal_access' } });
    const blocked = await clientLoginApi({ identifier: 'c@c.com', password: 'x' });
    expect('status' in blocked && blocked.status).toBe('no_portal_access');
  });
});
