import { api } from '../client';
import { getMeApi, loginApi } from '../auth.api';

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
});
