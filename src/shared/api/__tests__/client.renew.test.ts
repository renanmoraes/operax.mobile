import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { isNetworkError, renewSession } from '../client';
import { getAccessToken, getRefreshToken, setTokens } from '../token-store';

const mockMem = new Map<string, string>();
jest.mock('../../storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void mockMem.set(k, v)),
  deleteItem: jest.fn(async (k: string) => void mockMem.delete(k)),
}));

const cfg = { headers: {} } as InternalAxiosRequestConfig;
const httpError = (status: number) => new AxiosError(String(status), 'ERR_BAD_REQUEST', cfg, null, { status, statusText: '', headers: {}, config: cfg, data: {} });
const semInternet = () => new AxiosError('Network Error', 'ERR_NETWORK', cfg, {});

beforeEach(async () => {
  mockMem.clear();
  await setTokens('a-staff', 'r-staff', 'staff');
  await setTokens('sessao-cliente', 'identidade-cliente', 'client');
});
afterEach(() => jest.restoreAllMocks());

describe('renovar a sessão ao abrir o app', () => {
  it('a equipe troca o refresh token', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'novo-staff', refresh_token: 'novo-refresh' } });
    await expect(renewSession('staff')).resolves.toBe(true);
    expect(await getAccessToken('staff')).toBe('novo-staff');
    expect(await getRefreshToken('staff')).toBe('novo-refresh');
  });

  it('o cliente ganha sessão nova da mesma empresa pelo portal', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'sessao-nova', identity_token: 'identidade-nova' } });
    await expect(renewSession('client')).resolves.toBe(true);
    expect(String(post.mock.calls[0][0])).toContain('/api/public/portal/me/renew');
    expect(await getAccessToken('client')).toBe('sessao-nova');
    expect(await getRefreshToken('client')).toBe('identidade-nova');
  });

  it('sessão que caiu (outro aparelho, empresa desconectou) devolve falso', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(httpError(401));
    await expect(renewSession('client')).resolves.toBe(false);
    await expect(renewSession('staff')).resolves.toBe(false);
  });

  it('sem internet o erro sobe e é reconhecido como falta de rede (a sessão guardada fica)', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(semInternet());
    const err = await renewSession('client').catch((e: unknown) => e);
    expect(isNetworkError(err)).toBe(true);
    expect(await getAccessToken('client')).toBe('sessao-cliente');
    expect(isNetworkError(httpError(401))).toBe(false);
  });
});
