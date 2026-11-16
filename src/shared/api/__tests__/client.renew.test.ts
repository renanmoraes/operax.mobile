import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { api, isTransientError, renewSession } from '../client';
import { getAccessToken, getRefreshToken, setSavedRole, setTokens } from '../token-store';

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
  it('a equipe não gira o token a cada abertura (recarregar o perfil renova quando precisa)', async () => {
    const post = jest.spyOn(axios, 'post');
    await expect(renewSession('staff')).resolves.toBe('ok');
    expect(post).not.toHaveBeenCalled();
    expect(await getRefreshToken('staff')).toBe('r-staff');
  });

  it('o cliente ganha sessão nova da mesma empresa pelo portal', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'sessao-nova', identity_token: 'identidade-nova' } });
    await expect(renewSession('client')).resolves.toBe('ok');
    expect(String(post.mock.calls[0][0])).toContain('/api/public/portal/me/renew');
    expect(await getAccessToken('client')).toBe('sessao-nova');
    expect(await getRefreshToken('client')).toBe('identidade-nova');
  });

  it('sessão que caiu (outro aparelho, empresa desconectou) devolve gone; a que não renova devolve skip', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(httpError(401));
    await expect(renewSession('client')).resolves.toBe('gone');
    jest.spyOn(axios, 'post').mockRejectedValue(httpError(400));
    await expect(renewSession('client')).resolves.toBe('skip');
    expect(await getAccessToken('client')).toBe('sessao-cliente');
  });

  it('sem internet o erro sobe e é reconhecido como falta de rede (a sessão guardada fica)', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(semInternet());
    const err = await renewSession('client').catch((e: unknown) => e);
    expect(isTransientError(err)).toBe(true);
    expect(await getAccessToken('client')).toBe('sessao-cliente');
    expect(isTransientError(httpError(401))).toBe(false);
  });

  it('servidor fora (5xx) também é passageiro; só 401/403 encerram a sessão', () => {
    expect(isTransientError(httpError(502))).toBe(true);
    expect(isTransientError(httpError(403))).toBe(false);
  });

  it('401 com a renovação caindo por falta de internet não apaga a sessão guardada', async () => {
    await setSavedRole('staff');
    api.defaults.adapter = async (config) => {
      throw new AxiosError('401', 'ERR_BAD_REQUEST', config, null, { status: 401, statusText: '', headers: {}, config, data: {} });
    };
    jest.spyOn(axios, 'post').mockRejectedValue(semInternet());
    const err = await api.get('/api/auth/me').catch((e: unknown) => e);
    expect(isTransientError(err)).toBe(true);
    expect(await getAccessToken('staff')).toBe('a-staff');
    expect(await getRefreshToken('staff')).toBe('r-staff');
  });

  it('a pessoa trocou de empresa enquanto renovava: o token da empresa nova fica', async () => {
    jest.spyOn(axios, 'post').mockImplementation(async () => {
      await setTokens('sessao-empresa-b', 'identidade-cliente', 'client');
      return { data: { access_token: 'renovada-empresa-a', identity_token: 'x' } };
    });
    await renewSession('client');
    expect(await getAccessToken('client')).toBe('sessao-empresa-b');
  });
});
